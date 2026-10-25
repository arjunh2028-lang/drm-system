const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { logActivity } = require('../services/activityService');
const {
  VALID_RIGHT_TYPES,
  getContentById,
  canManageRights,
  getRightsForContent,
  getRightsForUser,
} = require('../services/rightsService');
const { grantLicense, revokeLicense, verifyAccess } = require('../services/blockchainService');
const { validContentId } = require('../services/contentProtectionService');
const { logSecurityEvent } = require('../services/securityAuditService');

async function requireBlockchainManager(content, req) {
  const [assets] = await pool.query('SELECT status, owner_wallet FROM blockchain_assets WHERE content_id = ?', [content.content_id]);
  if (!assets.length) return;
  if (assets[0].status !== 'CONFIRMED') throw new ApiError(409, 'Blockchain asset is not confirmed; resolve or retry registration before managing licenses.');
  const [walletRows] = await pool.query('SELECT user_id, wallet_address FROM users WHERE user_id IN (?, ?)', [req.user.userId, content.owner_id]);
  const actorWallet = walletRows.find((row) => row.user_id === req.user.userId)?.wallet_address;
  const ownerWallet = walletRows.find((row) => row.user_id === content.owner_id)?.wallet_address;
  if (!actorWallet || !ownerWallet || ownerWallet.toLowerCase() !== assets[0].owner_wallet.toLowerCase()) {
    throw new ApiError(403, 'Verified wallets do not match the registered asset owner.');
  }
  const isOwner = content.owner_id === req.user.userId;
  const authorized = await verifyAccess(content.content_id, content.file_hash, ownerWallet, actorWallet, 'SHARE', isOwner);
  if (!authorized) throw new ApiError(403, 'An active on-chain SHARE license or owner record is required to manage licenses.');
}

// GET /api/content/:id/rights
const listRights = asyncHandler(async (req, res) => {
  const contentId = validContentId(req.params.id);
  const content = await getContentById(contentId);
  if (!content) throw new ApiError(404, 'Content not found.');

  const isOwner = content.owner_id === req.user.userId;
  const canManage = await canManageRights(req.user.userId, contentId);
  if (!isOwner && !canManage) {
    throw new ApiError(403, 'You are not authorized to view rights for this content.');
  }
  await requireBlockchainManager(content, req);

  const rights = await getRightsForContent(contentId);
  res.json(rights);
});

// POST /api/content/:id/rights   body: { userId, rightType }
const grantRight = asyncHandler(async (req, res) => {
  const contentId = validContentId(req.params.id);
  const { userId, rightType, expiresAt } = req.body;

  if (!userId || !rightType) {
    throw new ApiError(400, 'userId and rightType are required.');
  }
  if (!VALID_RIGHT_TYPES.includes(rightType)) {
    throw new ApiError(400, `rightType must be one of ${VALID_RIGHT_TYPES.join(', ')}.`);
  }

  const content = await getContentById(contentId);
  if (!content) throw new ApiError(404, 'Content not found.');

  const allowed = await canManageRights(req.user.userId, contentId);
  if (!allowed) {
    throw new ApiError(403, 'Only the owner or a user with SHARE rights can grant permissions.');
  }
  await requireBlockchainManager(content, req);

  if (Number(userId) === content.owner_id) {
    throw new ApiError(400, 'The owner already has all rights over their own content.');
  }

  const [targetUser] = await pool.query('SELECT user_id FROM users WHERE user_id = ?', [userId]);
  if (targetUser.length === 0) {
    throw new ApiError(404, 'Target user not found.');
  }

  const [blockchainAssets] = await pool.query('SELECT status FROM blockchain_assets WHERE content_id = ?', [contentId]);
  let chainResult = null;
  let chainOperationId = null;
  let expirationDate = null;
  let expirationSeconds = 0;
  if (expiresAt !== undefined && expiresAt !== null && expiresAt !== '') {
    expirationSeconds = Number(expiresAt);
    if (!Number.isSafeInteger(expirationSeconds) || expirationSeconds <= Math.floor(Date.now() / 1000)) {
      throw new ApiError(400, 'expiresAt must be a future Unix timestamp in seconds.');
    }
    expirationDate = new Date(expirationSeconds * 1000);
  }
  const isBlockchainEnabled = blockchainAssets.length > 0 && blockchainAssets[0].status === 'CONFIRMED';
  if (isBlockchainEnabled) {
    const [wallets] = await pool.query('SELECT wallet_address FROM users WHERE user_id = ?', [userId]);
    if (!wallets[0]?.wallet_address) throw new ApiError(409, 'The license recipient must link a verified wallet first.');
    const [operation] = await pool.query(
      `INSERT INTO blockchain_operations (content_id, actor_user_id, operation_type, wallet_address, right_type, expiration_timestamp, status)
       VALUES (?, ?, 'GRANT', ?, ?, ?, 'PENDING')`,
      [contentId, req.user.userId, wallets[0].wallet_address, rightType, expirationSeconds || null]
    );
    chainOperationId = operation.insertId;
    try {
      chainResult = await grantLicense(contentId, wallets[0].wallet_address, rightType, expirationSeconds,
        async ({ hash }) => pool.query("UPDATE blockchain_operations SET transaction_hash = ? WHERE operation_id = ?", [hash, chainOperationId]));
    } catch (err) {
      await pool.query(`UPDATE blockchain_operations SET status = IF(transaction_hash IS NULL, 'FAILED', 'PENDING'), database_sync_status = IF(transaction_hash IS NULL, 'FAILED', 'PENDING'), error_message = ? WHERE operation_id = ?`, [String(err.message || 'Grant failed').slice(0, 490), chainOperationId]);
      await logSecurityEvent({ req, eventType: 'LICENSE_GRANT_FAILED', contentId, outcome: 'ERROR', detail: 'Blockchain grant failed or is awaiting confirmation' });
      if (err instanceof ApiError) throw err;
      throw new ApiError(502, `Blockchain license grant failed: ${String(err.message || 'transaction failed').slice(0, 250)}`);
    }
    await pool.query(
      `UPDATE blockchain_operations SET status = 'CONFIRMED', transaction_hash = ?, block_number = ?, database_sync_status = 'PENDING' WHERE operation_id = ?`,
      [chainResult.hash, chainResult.blockNumber, chainOperationId]
    );
  } else if (expirationDate) {
    throw new ApiError(400, 'License expiration is available for blockchain-enabled assets only.');
  }

  // sp_grant_right is idempotent: inserts a new row, or flips an
  // existing REVOKED row for this (content, user, right) back to ACTIVE.
  await pool.query('CALL sp_grant_right(?, ?, ?, ?)', [contentId, userId, rightType, req.user.userId]);
  const [rightRows] = await pool.query(
    'SELECT right_id FROM rights WHERE content_id = ? AND user_id = ? AND right_type = ?',
    [contentId, userId, rightType]
  );
  if (isBlockchainEnabled) {
    await pool.query(
      `INSERT INTO blockchain_rights (right_id, expiration_timestamp, transaction_hash, status)
       VALUES (?, ?, ?, 'CONFIRMED') ON DUPLICATE KEY UPDATE expiration_timestamp = VALUES(expiration_timestamp), transaction_hash = VALUES(transaction_hash), status = 'CONFIRMED', error_message = NULL`,
      [rightRows[0].right_id, expirationSeconds || null, chainResult?.hash || null]
    );
    await pool.query(`UPDATE blockchain_operations SET right_id = ?, database_sync_status = 'SYNCED' WHERE operation_id = ?`, [rightRows[0].right_id, chainOperationId]);
  }
  // Note: the RIGHT_GRANTED activity_log entry is written automatically
  // by the trg_rights_after_insert / trg_rights_after_update triggers.

  res.status(201).json({ message: `${rightType} granted successfully.`, blockchain: isBlockchainEnabled, transactionHash: chainResult?.hash || null, expiresAt: expirationSeconds || null });
});

// DELETE /api/content/:id/rights/:rightId
const revokeRight = asyncHandler(async (req, res) => {
  const contentId = validContentId(req.params.id);
  const rightId = validContentId(req.params.rightId);

  const content = await getContentById(contentId);
  if (!content) throw new ApiError(404, 'Content not found.');

  const allowed = await canManageRights(req.user.userId, contentId);
  if (!allowed) {
    throw new ApiError(403, 'Only the owner or a user with SHARE rights can revoke permissions.');
  }
  await requireBlockchainManager(content, req);

  const [rows] = await pool.query(
    'SELECT right_id, status FROM rights WHERE right_id = ? AND content_id = ?',
    [rightId, contentId]
  );
  if (rows.length === 0) throw new ApiError(404, 'Right not found for this content.');
  if (rows[0].status === 'REVOKED') throw new ApiError(400, 'That right has already been revoked.');

  const [blockchainAssets] = await pool.query('SELECT status FROM blockchain_assets WHERE content_id = ?', [contentId]);
  let chainResult = null;
  let chainOperationId = null;
  const isBlockchainEnabled = blockchainAssets.length > 0 && blockchainAssets[0].status === 'CONFIRMED';
  if (isBlockchainEnabled) {
    const [licenseRows] = await pool.query(
      `SELECT u.wallet_address, r.user_id, r.right_type FROM rights r JOIN users u ON u.user_id = r.user_id WHERE r.right_id = ?`,
      [rightId]
    );
    if (!licenseRows[0]?.wallet_address) throw new ApiError(409, 'The license recipient has no verified wallet.');
    const [operation] = await pool.query(
      `INSERT INTO blockchain_operations (content_id, right_id, actor_user_id, operation_type, wallet_address, right_type, status)
       VALUES (?, ?, ?, 'REVOKE', ?, ?, 'PENDING')`,
      [contentId, rightId, req.user.userId, licenseRows[0].wallet_address, licenseRows[0].right_type]
    );
    chainOperationId = operation.insertId;
    try {
      chainResult = await revokeLicense(contentId, licenseRows[0].wallet_address, licenseRows[0].right_type,
        async ({ hash }) => pool.query("UPDATE blockchain_operations SET transaction_hash = ? WHERE operation_id = ?", [hash, chainOperationId]));
    } catch (err) {
      await pool.query(`UPDATE blockchain_operations SET status = IF(transaction_hash IS NULL, 'FAILED', 'PENDING'), database_sync_status = IF(transaction_hash IS NULL, 'FAILED', 'PENDING'), error_message = ? WHERE operation_id = ?`, [String(err.message || 'Revocation failed').slice(0, 490), chainOperationId]);
      await logSecurityEvent({ req, eventType: 'LICENSE_REVOKE_FAILED', contentId, outcome: 'ERROR', detail: 'Blockchain revocation failed or is awaiting confirmation' });
      if (err instanceof ApiError) throw err;
      throw new ApiError(502, `Blockchain license revocation failed: ${String(err.message || 'transaction failed').slice(0, 250)}`);
    }
    await pool.query(
      `UPDATE blockchain_operations SET status = 'CONFIRMED', transaction_hash = ?, block_number = ?, database_sync_status = 'PENDING' WHERE operation_id = ?`,
      [chainResult?.hash || null, chainResult?.blockNumber || null, chainOperationId]
    );
  }

  await pool.query('CALL sp_revoke_right(?, ?)', [rightId, req.user.userId]);
  if (isBlockchainEnabled) {
    await pool.query(
      `UPDATE blockchain_rights SET status = 'CONFIRMED', transaction_hash = COALESCE(?, transaction_hash), error_message = NULL WHERE right_id = ?`,
      [chainResult?.hash || null, rightId]
    );
    await pool.query(`UPDATE blockchain_operations SET database_sync_status = 'SYNCED' WHERE operation_id = ?`, [chainOperationId]);
  }
  // The activity_log entry for RIGHT_REVOKED is written by the trigger.

  res.json({ message: 'Right revoked successfully.', blockchain: isBlockchainEnabled, transactionHash: chainResult?.hash || null });
});

// GET /api/rights/mine -> all ACTIVE rights the current user holds
// (used by the "Rights I Have" section of the dashboard / accessible page)
const myRights = asyncHandler(async (req, res) => {
  const rows = await getRightsForUser(req.user.userId);
  res.json(rows);
});

module.exports = { listRights, grantRight, revokeRight, myRights };
