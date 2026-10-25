const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getContentById } = require('../services/rightsService');
const { getNetworkConfig, registerAsset, grantLicense } = require('../services/blockchainService');
const { validContentId } = require('../services/contentProtectionService');
const { logSecurityEvent } = require('../services/securityAuditService');

const getAssetStatus = asyncHandler(async (req, res) => {
  const contentId = validContentId(req.params.id);
  const content = await getContentById(contentId);
  if (!content) throw new ApiError(404, 'Content not found.');
  if (content.owner_id !== req.user.userId) throw new ApiError(403, 'Only the content owner can inspect blockchain registration details.');
  const [rows] = await pool.query('SELECT * FROM blockchain_assets WHERE content_id = ?', [contentId]);
  res.json({ enabled: rows.length > 0, status: rows[0]?.status || 'LEGACY', ...rows[0], contentId });
});

const registerAssetOnChain = asyncHandler(async (req, res) => {
  const contentId = validContentId(req.params.id);
  const content = await getContentById(contentId);
  if (!content) throw new ApiError(404, 'Content not found.');
  if (content.owner_id !== req.user.userId) throw new ApiError(403, 'Only the content owner can register this asset.');

  const [ownerRows] = await pool.query('SELECT wallet_address FROM users WHERE user_id = ?', [req.user.userId]);
  const ownerWallet = ownerRows[0]?.wallet_address;
  if (!ownerWallet) throw new ApiError(409, 'Link and verify your wallet before registering an asset.');

  const { chainId, address } = getNetworkConfig();
  if (!address) throw new ApiError(503, 'Blockchain contract address is not configured.');
  const [existingAsset] = await pool.query('SELECT * FROM blockchain_assets WHERE content_id = ?', [contentId]);
  if (existingAsset.length && existingAsset[0].status === 'CONFIRMED') {
    if (Number(existingAsset[0].chain_id) !== chainId || existingAsset[0].contract_address.toLowerCase() !== address.toLowerCase() || existingAsset[0].owner_wallet.toLowerCase() !== ownerWallet.toLowerCase()) {
      throw new ApiError(409, 'Confirmed asset configuration differs from this content, wallet, chain, or contract.');
    }
    return res.json(existingAsset[0]);
  }
  const [claim] = await pool.query(
    `INSERT IGNORE INTO blockchain_assets (content_id, chain_id, contract_address, owner_wallet, status)
     VALUES (?, ?, ?, ?, 'PENDING')`,
    [contentId, chainId, address, ownerWallet]
  );
  if (!claim.affectedRows) {
    const [currentRows] = await pool.query(
      'SELECT *, (updated_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 2 MINUTE)) AS is_stale FROM blockchain_assets WHERE content_id = ?',
      [contentId]
    );
    const current = currentRows[0];
    if (current?.status === 'CONFIRMED') {
      if (Number(current.chain_id) !== chainId || current.contract_address.toLowerCase() !== address.toLowerCase() || current.owner_wallet.toLowerCase() !== ownerWallet.toLowerCase()) {
        throw new ApiError(409, 'Confirmed asset configuration differs from this content, wallet, chain, or contract.');
      }
      return res.json(current);
    }
    let claimed;
    if (current?.status === 'FAILED') {
      [claimed] = await pool.query(
        `UPDATE blockchain_assets SET chain_id = ?, contract_address = ?, owner_wallet = ?, status = 'PENDING', error_message = NULL
         WHERE content_id = ? AND status = 'FAILED'`,
        [chainId, address, ownerWallet, contentId]
      );
    } else if (current?.status === 'PENDING') {
      if (!current.is_stale) throw new ApiError(409, 'Asset registration is already in progress. Retry after it completes.');
      [claimed] = await pool.query(
        `UPDATE blockchain_assets SET chain_id = ?, contract_address = ?, owner_wallet = ?, error_message = NULL
         WHERE content_id = ? AND status = 'PENDING' AND updated_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 2 MINUTE)`,
        [chainId, address, ownerWallet, contentId]
      );
    }
    if (!claimed?.affectedRows) throw new ApiError(409, 'Another registration attempt is in progress; retry shortly.');
  }
  try {
    // Set PENDING before reading the legacy rights snapshot. Grant/revoke
    // endpoints reject writes during this short migration window.
    const [activeRights] = await pool.query(
      `SELECT r.right_id, r.user_id, r.right_type, r.granted_timestamp, u.wallet_address
       FROM rights r JOIN users u ON u.user_id = r.user_id
       WHERE r.content_id = ? AND r.status = 'ACTIVE'`, [contentId]
    );
    const noWallet = activeRights.find((right) => !right.wallet_address);
    if (noWallet) throw new ApiError(409, `Active license recipient ${noWallet.user_id} must link a verified wallet before registration can migrate rights.`);

    const registered = await registerAsset(contentId, content.file_hash, ownerWallet, async ({ hash }) => {
      const [saved] = await pool.query("UPDATE blockchain_assets SET registration_tx = ? WHERE content_id = ? AND status = 'PENDING'", [hash, contentId]);
      if (!saved.affectedRows) throw new Error('Asset transaction hash could not be durably recorded.');
    });
    if (registered.hash) {
      await pool.query('UPDATE blockchain_assets SET registration_tx = ? WHERE content_id = ?', [registered.hash, contentId]);
    }
    for (const right of activeRights) {
      const expiresAt = 0;
      const [operation] = await pool.query(
        `INSERT INTO blockchain_operations (content_id, right_id, actor_user_id, operation_type, wallet_address, right_type, status)
         VALUES (?, ?, ?, 'GRANT', ?, ?, 'PENDING')`,
        [contentId, right.right_id, req.user.userId, right.wallet_address, right.right_type]
      );
      let result;
      try {
        result = await grantLicense(contentId, right.wallet_address, right.right_type, expiresAt,
          async ({ hash }) => pool.query('UPDATE blockchain_operations SET transaction_hash = ? WHERE operation_id = ?', [hash, operation.insertId]));
      } catch (err) {
        await pool.query(`UPDATE blockchain_operations SET status = IF(transaction_hash IS NULL, 'FAILED', 'PENDING'), database_sync_status = IF(transaction_hash IS NULL, 'FAILED', 'PENDING'), error_message = ? WHERE operation_id = ?`, [String(err.message || 'License migration failed').slice(0, 490), operation.insertId]);
        throw err;
      }
      await pool.query(
        `UPDATE blockchain_operations SET status = 'CONFIRMED', transaction_hash = ?, block_number = ?, database_sync_status = 'PENDING' WHERE operation_id = ?`,
        [result.hash, result.blockNumber, operation.insertId]
      );
      await pool.query(
        `INSERT INTO blockchain_rights (right_id, expiration_timestamp, transaction_hash, status)
         VALUES (?, NULL, ?, 'CONFIRMED') ON DUPLICATE KEY UPDATE transaction_hash = COALESCE(VALUES(transaction_hash), transaction_hash), status = 'CONFIRMED', error_message = NULL`,
        [right.right_id, result.hash]
      );
      await pool.query(`UPDATE blockchain_operations SET database_sync_status = 'SYNCED' WHERE operation_id = ?`, [operation.insertId]);
    }
    await pool.query('UPDATE blockchain_assets SET status = \'CONFIRMED\', error_message = NULL WHERE content_id = ?', [contentId]);
    const [assetRows] = await pool.query('SELECT * FROM blockchain_assets WHERE content_id = ?', [contentId]);
    res.status(200).json({ ...assetRows[0], alreadyRegistered: registered.alreadyRegistered || false });
  } catch (err) {
    const reported = err instanceof ApiError ? err : new ApiError(502, `Blockchain registration failed: ${String(err.message || 'transaction failed').slice(0, 250)}`);
    await pool.query('UPDATE blockchain_assets SET status = \'FAILED\', error_message = ? WHERE content_id = ?', [reported.message.slice(0, 490), contentId]);
    await logSecurityEvent({ req, eventType: 'ASSET_REGISTRATION_FAILED', contentId, outcome: 'ERROR', detail: 'Blockchain asset registration or rights migration failed' });
    throw reported;
  }
});

module.exports = { getAssetStatus, registerAssetOnChain };
