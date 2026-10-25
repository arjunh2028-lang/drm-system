const path = require('path');
const fs = require('fs');
const { pool } = require('../config/db');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { sha256File } = require('../services/hashService');
const { logActivity } = require('../services/activityService');
const {
  getContentById,
  hasActiveRight,
  getRightsForContent,
} = require('../services/rightsService');
const { UPLOAD_DIR, PROJECT_ROOT } = require('../config/paths');
const { verifyAccess } = require('../services/blockchainService');
const { grantLicense } = require('../services/blockchainService');
const { encryptBuffer } = require('../services/encryptionService');
const { authorizeContentAccess, readAuthorizedContent, validContentId, watermarkText } = require('../services/contentProtectionService');
const { logSecurityEvent } = require('../services/securityAuditService');

function contentIdFromRequest(value) { return validContentId(value); }

function responseMimeType(filename) {
  const byExtension = {
    '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
  };
  return byExtension[path.extname(filename || '').toLowerCase()] || 'application/octet-stream';
}

async function protectedDelivery(req, res, mode) {
  const contentId = contentIdFromRequest(req.params.id);
  const content = await getContentById(contentId);
  if (!content) throw new ApiError(404, 'Content not found.');
  const rightType = mode === 'download' ? 'DOWNLOAD' : 'VIEW';
  try {
    await authorizeContentAccess({ content, req, rightType });
    const plaintext = await readAuthorizedContent(content);
    const [userRows] = await pool.query('SELECT name FROM users WHERE user_id = ?', [req.user.userId]);
    if (!userRows.length) throw new ApiError(401, 'Authenticated account no longer exists.');
    const watermarked = watermarkText(plaintext, content, { ...req.user, name: userRows[0].name });
    await logActivity({ contentId, actorId: req.user.userId, action: mode === 'download' ? 'CONTENT_DOWNLOADED' : 'CONTENT_VIEWED', details: mode === 'download' ? 'Downloaded protected content' : 'Viewed protected content' });
    const safeName = path.basename(content.original_filename).replace(/[\r\n"\\]/g, '_');
    res.set({
      'Content-Type': responseMimeType(content.original_filename),
      'Content-Disposition': `${mode === 'download' ? 'attachment' : 'inline'}; filename="${safeName}"`,
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "sandbox; default-src 'none'",
      'Referrer-Policy': 'no-referrer',
      'X-DRM-Encryption': 'AES-256-GCM',
      'X-DRM-Watermark': watermarked.applied ? 'applied' : 'unsupported-format',
    });
    return res.status(200).send(watermarked.data);
  } catch (err) {
    await logSecurityEvent({ req, eventType: `${rightType}_${err.statusCode === 403 ? 'DENIED' : 'DELIVERY_ERROR'}`, contentId, outcome: err.statusCode === 403 ? 'DENIED' : 'ERROR', detail: err.statusCode === 403 ? 'Authorization denied' : 'Protected content could not be verified' });
    throw err;
  }
}

async function requireBlockchainDecision(content, req, rightType, isOwner) {
  const [assets] = await pool.query('SELECT status, owner_wallet FROM blockchain_assets WHERE content_id = ?', [content.content_id]);
  if (!assets.length) return; // Explicit legacy path, preserving V1 behavior.
  // Preserve the established MySQL behavior until asset registration and its
  // active-license migration are fully confirmed. Once confirmed, fail closed.
  if (assets[0].status !== 'CONFIRMED') throw new ApiError(503, 'Blockchain asset is not confirmed; access cannot be verified.');
  const [wallets] = await pool.query(
    'SELECT user_id, wallet_address FROM users WHERE user_id IN (?, ?)',
    [req.user.userId, content.owner_id]
  );
  const currentWallet = wallets.find((row) => row.user_id === req.user.userId)?.wallet_address;
  const ownerWallet = wallets.find((row) => row.user_id === content.owner_id)?.wallet_address;
  if (!currentWallet || !ownerWallet || ownerWallet.toLowerCase() !== assets[0].owner_wallet.toLowerCase()) {
    throw new ApiError(403, 'A verified wallet matching the on-chain ownership record is required.');
  }
  const allowed = await verifyAccess(content.content_id, content.file_hash, ownerWallet, currentWallet, rightType, isOwner);
  if (!allowed) throw new ApiError(403, 'The required blockchain license is invalid, expired, revoked, or does not match this asset.');
}

// GET /api/content  -> content owned by the current user ("My Content")
const listOwnedContent = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT content_id, title, original_filename, file_size, file_hash, encryption_status, upload_timestamp
     FROM content WHERE owner_id = ? ORDER BY upload_timestamp DESC`,
    [req.user.userId]
  );
  res.json(rows);
});

// GET /api/content/accessible -> content the user can access but does
// NOT own, i.e. they hold at least one ACTIVE right on it.
const listAccessibleContent = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT DISTINCT
        c.content_id, c.title, c.original_filename, c.file_size, c.encryption_status, c.upload_timestamp,
        u.name AS owner_name,
        GROUP_CONCAT(DISTINCT r.right_type ORDER BY r.right_type SEPARATOR ',') AS my_rights
     FROM content c
     JOIN rights r ON r.content_id = c.content_id AND r.user_id = ? AND r.status = 'ACTIVE'
       AND (NOT EXISTS (SELECT 1 FROM blockchain_assets ba WHERE ba.content_id = c.content_id AND ba.status = 'CONFIRMED')
         OR EXISTS (SELECT 1 FROM blockchain_rights br WHERE br.right_id = r.right_id AND br.status = 'CONFIRMED'
           AND (br.expiration_timestamp IS NULL OR br.expiration_timestamp = 0 OR br.expiration_timestamp > UNIX_TIMESTAMP())))
     JOIN users u  ON u.user_id = c.owner_id
     WHERE c.owner_id != ?
     GROUP BY c.content_id, c.title, c.original_filename, c.file_size, c.encryption_status, c.upload_timestamp, u.name
     ORDER BY c.upload_timestamp DESC`,
    [req.user.userId, req.user.userId]
  );
  const withArrays = rows.map((r) => ({ ...r, my_rights: r.my_rights ? r.my_rights.split(',') : [] }));
  res.json(withArrays);
});

// POST /api/content  (multipart/form-data: file, title)
const uploadContent = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'A file is required.');
  }
  const rawTitle = req.body.title || req.file.originalname;
  if (typeof rawTitle !== 'string') throw new ApiError(400, 'Title must be text.');
  const title = rawTitle.trim();
  if (!title) {
    throw new ApiError(400, 'Title is required.');
  }

  const fileHash = require('crypto').createHash('sha256').update(req.file.buffer).digest('hex');
  const fileId = require('crypto').randomBytes(16).toString('hex');
  const storedFilename = `${fileId}.drm`;
  const absolutePath = path.join(UPLOAD_DIR, storedFilename);
  const encrypted = encryptBuffer(req.file.buffer);
  try {
    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.promises.writeFile(absolutePath, encrypted.ciphertext, { flag: 'wx', mode: 0o600 });
  } catch (err) {
    await fs.promises.unlink(absolutePath).catch(() => {});
    throw err;
  }
  let inserted = false;
  try {
    const [result] = await pool.query(
      `INSERT INTO content (title, original_filename, stored_filename, file_path, file_hash, file_size, owner_id,
        encryption_status, encrypted_dek, kek_nonce, kek_auth_tag, content_nonce, content_auth_tag, encrypted_file_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ENCRYPTED', ?, ?, ?, ?, ?, ?)`,
      [title, req.file.originalname, storedFilename, path.relative(PROJECT_ROOT, absolutePath), fileHash,
        req.file.size, req.user.userId, encrypted.metadata.encryptedDek, encrypted.metadata.wrapIv,
        encrypted.metadata.wrapTag, encrypted.metadata.contentIv, encrypted.metadata.contentTag, encrypted.metadata.encryptedHash]
    );
    inserted = true;
    await logActivity({ contentId: result.insertId, actorId: req.user.userId, action: 'CONTENT_UPLOADED', details: `Encrypted upload ${path.basename(req.file.originalname).slice(0, 160)}` })
      .catch((err) => console.error('[activity] upload event could not be recorded:', err.message));
    res.status(201).json({
      message: 'Content uploaded and encrypted successfully.',
      content: { id: result.insertId, title, originalFilename: req.file.originalname, fileSize: req.file.size, fileHash, encryptionStatus: 'ENCRYPTED' },
    });
  } catch (err) {
    if (!inserted) await fs.promises.unlink(absolutePath).catch(() => {});
    throw err;
  }
});

// GET /api/content/:id -> full details, current rights, my rights
const getContentDetails = asyncHandler(async (req, res) => {
  const contentId = contentIdFromRequest(req.params.id);
  const content = await getContentById(contentId);
  if (!content) throw new ApiError(404, 'Content not found.');

  const isOwner = content.owner_id === req.user.userId;
  const [viewOk, downloadOk, shareOk] = await Promise.all([
    hasActiveRight(req.user.userId, contentId, 'VIEW'),
    hasActiveRight(req.user.userId, contentId, 'DOWNLOAD'),
    hasActiveRight(req.user.userId, contentId, 'SHARE'),
  ]);

  if (!isOwner && !viewOk && !downloadOk && !shareOk) {
    throw new ApiError(403, 'You do not have access to this content.');
  }

  if (!isOwner && !viewOk && !downloadOk && shareOk) {
    await requireBlockchainDecision(content, req, 'SHARE', false);
  }

  const rights = await getRightsForContent(contentId);
  const [blockchainRows] = await pool.query('SELECT * FROM blockchain_assets WHERE content_id = ?', [contentId]);
  const [blockchainOperations] = (isOwner || shareOk)
    ? await pool.query(
        `SELECT operation_type, right_type, status, database_sync_status, transaction_hash, error_message, created_at
         FROM blockchain_operations WHERE content_id = ? ORDER BY operation_id DESC LIMIT 10`,
        [contentId]
      )
    : [[]];

  res.json({
    id: content.content_id,
    title: content.title,
    originalFilename: content.original_filename,
    fileSize: content.file_size,
    fileHash: content.file_hash,
    encryptionStatus: content.encryption_status || 'LEGACY',
    uploadTimestamp: content.upload_timestamp,
    owner: { id: content.owner_id, name: content.owner_name, email: content.owner_email },
    isOwner,
    myRights: { VIEW: isOwner || viewOk, DOWNLOAD: isOwner || downloadOk, SHARE: isOwner || shareOk },
    rights,
    blockchain: blockchainRows[0] || { status: 'LEGACY' },
    blockchainOperations,
  });
});

// GET /api/content/:id/view -> requires VIEW (owner always passes)
const viewContent = asyncHandler(async (req, res) => {
  return protectedDelivery(req, res, 'view');
});

// GET /api/content/:id/download -> requires DOWNLOAD (owner always passes)
const downloadContent = asyncHandler(async (req, res) => {
  return protectedDelivery(req, res, 'download');
});

// GET /api/content/:id/verify -> recompute SHA-256 and compare
const verifyIntegrity = asyncHandler(async (req, res) => {
  const contentId = contentIdFromRequest(req.params.id);
  const content = await getContentById(contentId);
  if (!content) throw new ApiError(404, 'Content not found.');

  const isOwner = content.owner_id === req.user.userId;
  const canAccess =
    isOwner ||
    (await hasActiveRight(req.user.userId, contentId, 'VIEW')) ||
    (await hasActiveRight(req.user.userId, contentId, 'DOWNLOAD'));
  if (!canAccess) throw new ApiError(403, 'You do not have access to this content.');

  try { await authorizeContentAccess({ content, req, rightType: isOwner ? 'VIEW' : (await hasActiveRight(req.user.userId, contentId, 'VIEW') ? 'VIEW' : 'DOWNLOAD') }); }
  catch (err) { await logSecurityEvent({ req, eventType: 'INTEGRITY_CHECK_DENIED', contentId, detail: 'Authorization or chain verification denied' }); throw err; }
  let currentHash;
  try {
    if (content.encryption_status === 'ENCRYPTED') {
      const plaintext = await readAuthorizedContent(content);
      currentHash = require('crypto').createHash('sha256').update(plaintext).digest('hex');
    } else {
      currentHash = await sha256File(require('../services/contentProtectionService').resolveStoredPath(content.file_path));
    }
  } catch (err) {
    if (err.statusCode === 404) return res.json({ status: 'MISSING', storedHash: content.file_hash, currentHash: null });
    await logSecurityEvent({ req, eventType: 'INTEGRITY_VERIFICATION_FAILED', contentId, outcome: 'ERROR', detail: 'Stored content failed integrity or decryption verification' });
    throw err;
  }
  const status = currentHash === content.file_hash ? 'VERIFIED' : 'MODIFIED';
  await logSecurityEvent({ req, eventType: 'INTEGRITY_CHECK', contentId, outcome: status === 'VERIFIED' ? 'ALLOWED' : 'DENIED', detail: status });

  res.json({ status, storedHash: content.file_hash, currentHash });
});

// GET /api/content/catalog -> all published content in marketplace with purchase status for the user
const listCatalogContent = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT 
        c.content_id, c.title, c.original_filename, c.file_size, c.upload_timestamp, c.file_hash, c.encryption_status,
        u.name AS owner_name, u.user_id AS owner_id,
        GROUP_CONCAT(DISTINCT r.right_type) AS user_rights
     FROM content c
     JOIN users u ON u.user_id = c.owner_id
     LEFT JOIN rights r ON r.content_id = c.content_id AND r.user_id = ? AND r.status = 'ACTIVE'
       AND (NOT EXISTS (SELECT 1 FROM blockchain_assets ba WHERE ba.content_id = c.content_id AND ba.status = 'CONFIRMED')
         OR EXISTS (SELECT 1 FROM blockchain_rights br WHERE br.right_id = r.right_id AND br.status = 'CONFIRMED'
           AND (br.expiration_timestamp IS NULL OR br.expiration_timestamp = 0 OR br.expiration_timestamp > UNIX_TIMESTAMP())))
     GROUP BY c.content_id, c.title, c.original_filename, c.file_size, c.upload_timestamp, c.file_hash, c.encryption_status, u.name, u.user_id
     ORDER BY c.upload_timestamp DESC`,
    [req.user.userId]
  );
  const formatted = rows.map((r) => ({
    ...r,
    is_owner: r.owner_id === req.user.userId,
    user_rights: r.user_rights ? r.user_rights.split(',') : [],
  }));
  res.json(formatted);
});

// POST /api/content/:id/purchase -> user acquires rights (VIEW or DOWNLOAD)
const purchaseRight = asyncHandler(async (req, res) => {
  const contentId = contentIdFromRequest(req.params.id);
  const { rightType = 'VIEW' } = req.body;
  const content = await getContentById(contentId);
  if (!content) throw new ApiError(404, 'Content not found.');

  if (content.owner_id === req.user.userId) {
    throw new ApiError(400, 'You already own this content with full administrative rights.');
  }

  const validTypes = ['VIEW', 'DOWNLOAD'];
  if (typeof rightType !== 'string' || !validTypes.includes(rightType.toUpperCase())) throw new ApiError(400, 'rightType must be VIEW or DOWNLOAD.');
  const typeToGrant = rightType.toUpperCase();

  // Check if right already exists
  const [existing] = await pool.query(
    `SELECT r.right_id, r.status, br.expiration_timestamp FROM rights r
     LEFT JOIN blockchain_rights br ON br.right_id = r.right_id
     WHERE r.content_id = ? AND r.user_id = ? AND r.right_type = ?`,
    [contentId, req.user.userId, typeToGrant]
  );
  if (existing.length > 0 && existing[0].status === 'ACTIVE' &&
      (existing[0].expiration_timestamp === null || existing[0].expiration_timestamp === 0 || Number(existing[0].expiration_timestamp) > Math.floor(Date.now() / 1000))) {
    return res.json({ message: `You already hold active ${typeToGrant} license for this file.` });
  }

  const [blockchainAssets] = await pool.query('SELECT status FROM blockchain_assets WHERE content_id = ?', [contentId]);
  if (blockchainAssets.length && blockchainAssets[0].status !== 'CONFIRMED') throw new ApiError(409, 'Blockchain asset is not confirmed; retry registration before acquiring a license.');
  const isBlockchainEnabled = blockchainAssets.length > 0 && blockchainAssets[0].status === 'CONFIRMED';
  let blockchainGrant = null;
  let blockchainOperationId = null;
  if (isBlockchainEnabled) {
    const [wallets] = await pool.query('SELECT wallet_address FROM users WHERE user_id = ?', [req.user.userId]);
    if (!wallets[0]?.wallet_address) throw new ApiError(409, 'Link and verify your wallet before acquiring this blockchain license.');
    const [operation] = await pool.query(
      `INSERT INTO blockchain_operations (content_id, actor_user_id, operation_type, wallet_address, right_type, status)
       VALUES (?, ?, 'GRANT', ?, ?, 'PENDING')`,
      [contentId, req.user.userId, wallets[0].wallet_address, typeToGrant]
    );
    blockchainOperationId = operation.insertId;
    try {
      blockchainGrant = await grantLicense(contentId, wallets[0].wallet_address, typeToGrant, 0,
        async ({ hash }) => pool.query("UPDATE blockchain_operations SET transaction_hash = ? WHERE operation_id = ?", [hash, blockchainOperationId]));
    } catch (err) {
      await pool.query(`UPDATE blockchain_operations SET status = IF(transaction_hash IS NULL, 'FAILED', 'PENDING'), database_sync_status = IF(transaction_hash IS NULL, 'FAILED', 'PENDING'), error_message = ? WHERE operation_id = ?`, [String(err.message || 'Grant failed').slice(0, 490), blockchainOperationId]);
      await logSecurityEvent({ req, eventType: 'LICENSE_GRANT_FAILED', contentId, outcome: 'ERROR', detail: 'Blockchain acquisition failed or is awaiting confirmation' });
      if (err instanceof ApiError) throw err;
      throw new ApiError(502, `Blockchain license grant failed: ${String(err.message || 'transaction failed').slice(0, 250)}`);
    }
    await pool.query(
      `UPDATE blockchain_operations SET status = 'CONFIRMED', transaction_hash = ?, block_number = ?, database_sync_status = 'PENDING' WHERE operation_id = ?`,
      [blockchainGrant.hash, blockchainGrant.blockNumber, blockchainOperationId]
    );
  }

  if (existing.length > 0) {
    await pool.query(
      `UPDATE rights SET status = 'ACTIVE', revoked_by = NULL, revoked_timestamp = NULL,
       granted_timestamp = CURRENT_TIMESTAMP WHERE right_id = ?`,
      [existing[0].right_id]
    );
  } else {
    await pool.query(
      `INSERT INTO rights (content_id, user_id, right_type, granted_by, status)
       VALUES (?, ?, ?, ?, 'ACTIVE')`,
      [contentId, req.user.userId, typeToGrant, content.owner_id]
    );
  }

  if (isBlockchainEnabled) {
    const [rightRows] = await pool.query(
      'SELECT right_id FROM rights WHERE content_id = ? AND user_id = ? AND right_type = ?',
      [contentId, req.user.userId, typeToGrant]
    );
    await pool.query(
      `INSERT INTO blockchain_rights (right_id, expiration_timestamp, transaction_hash, status)
       VALUES (?, NULL, ?, 'CONFIRMED') ON DUPLICATE KEY UPDATE transaction_hash = VALUES(transaction_hash), status = 'CONFIRMED', error_message = NULL`,
      [rightRows[0].right_id, blockchainGrant?.hash || null]
    );
    await pool.query(`UPDATE blockchain_operations SET right_id = ?, database_sync_status = 'SYNCED' WHERE operation_id = ?`, [rightRows[0].right_id, blockchainOperationId]);
  }

  await logActivity({
    contentId,
    actorId: req.user.userId,
    targetUserId: req.user.userId,
    action: 'RIGHT_ACQUIRED',
    details: `Purchased ${typeToGrant} license for "${content.title}"`,
  });

  res.status(201).json({ message: `Successfully acquired ${typeToGrant} license!`, blockchain: isBlockchainEnabled, transactionHash: blockchainGrant?.hash || null });
});

// GET /api/content/moderator/all -> all content across platform for moderator
const listAllContentModerator = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT 
        c.content_id, c.title, c.original_filename, c.stored_filename, c.file_size, c.file_hash, c.encryption_status, c.upload_timestamp,
        u.user_id AS owner_id, u.name AS owner_name, u.email AS owner_email,
        COUNT(DISTINCT CASE WHEN r.status = 'ACTIVE' THEN r.right_id END) AS active_rights_count
     FROM content c
     JOIN users u ON u.user_id = c.owner_id
     LEFT JOIN rights r ON r.content_id = c.content_id
     GROUP BY c.content_id, c.title, c.original_filename, c.stored_filename, c.file_size, c.file_hash, c.encryption_status, c.upload_timestamp, u.user_id, u.name, u.email
     ORDER BY c.upload_timestamp DESC`
  );
  res.json(rows);
});

// GET /api/content/moderator/verify-all -> batch scan all stored files and check SHA-256 integrity
const verifyAllIntegrity = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM content ORDER BY content_id');
  const results = [];
  let verifiedCount = 0;
  let modifiedCount = 0;
  let missingCount = 0;

  for (const item of rows) {
    const absolutePath = require('../services/contentProtectionService').resolveStoredPath(item.file_path);
    if (!fs.existsSync(absolutePath)) {
      results.push({ content_id: item.content_id, title: item.title, status: 'MISSING' });
      missingCount++;
    } else {
      let currentHash;
      if (item.encryption_status === 'ENCRYPTED') {
        const plain = await readAuthorizedContent(item);
        currentHash = require('crypto').createHash('sha256').update(plain).digest('hex');
      } else currentHash = await sha256File(absolutePath);
      const isVerified = currentHash === item.file_hash;
      if (isVerified) verifiedCount++;
      else modifiedCount++;
      results.push({
        content_id: item.content_id,
        title: item.title,
        status: isVerified ? 'VERIFIED' : 'MODIFIED',
        storedHash: item.file_hash,
        currentHash,
      });
    }
  }

  res.json({
    total: rows.length,
    verifiedCount,
    modifiedCount,
    missingCount,
    results,
  });
});

module.exports = {
  listOwnedContent,
  listAccessibleContent,
  uploadContent,
  getContentDetails,
  viewContent,
  downloadContent,
  verifyIntegrity,
  listCatalogContent,
  purchaseRight,
  listAllContentModerator,
  verifyAllIntegrity,
};
