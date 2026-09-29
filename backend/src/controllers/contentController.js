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

// GET /api/content  -> content owned by the current user ("My Content")
const listOwnedContent = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT content_id, title, original_filename, file_size, file_hash, upload_timestamp
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
        c.content_id, c.title, c.original_filename, c.file_size, c.upload_timestamp,
        u.name AS owner_name,
        GROUP_CONCAT(DISTINCT r.right_type ORDER BY r.right_type SEPARATOR ',') AS my_rights
     FROM content c
     JOIN rights r ON r.content_id = c.content_id AND r.user_id = ? AND r.status = 'ACTIVE'
     JOIN users u  ON u.user_id = c.owner_id
     WHERE c.owner_id != ?
     GROUP BY c.content_id, c.title, c.original_filename, c.file_size, c.upload_timestamp, u.name
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
  const title = (req.body.title || req.file.originalname).trim();
  if (!title) {
    // Clean up the orphaned upload before failing.
    fs.unlink(req.file.path, () => {});
    throw new ApiError(400, 'Title is required.');
  }

  const fileHash = await sha256File(req.file.path);

  const [result] = await pool.query(
    `INSERT INTO content (title, original_filename, stored_filename, file_path, file_hash, file_size, owner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      req.file.originalname,
      req.file.filename,
      path.relative(PROJECT_ROOT, req.file.path),
      fileHash,
      req.file.size,
      req.user.userId,
    ]
  );

  await logActivity({
    contentId: result.insertId,
    actorId: req.user.userId,
    action: 'CONTENT_UPLOADED',
    details: `Uploaded ${req.file.originalname}`,
  });

  res.status(201).json({
    message: 'Content uploaded successfully.',
    content: {
      id: result.insertId,
      title,
      originalFilename: req.file.originalname,
      fileSize: req.file.size,
      fileHash,
    },
  });
});

// GET /api/content/:id -> full details, current rights, my rights
const getContentDetails = asyncHandler(async (req, res) => {
  const contentId = Number(req.params.id);
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

  const rights = await getRightsForContent(contentId);

  res.json({
    id: content.content_id,
    title: content.title,
    originalFilename: content.original_filename,
    fileSize: content.file_size,
    fileHash: content.file_hash,
    uploadTimestamp: content.upload_timestamp,
    owner: { id: content.owner_id, name: content.owner_name, email: content.owner_email },
    isOwner,
    myRights: { VIEW: isOwner || viewOk, DOWNLOAD: isOwner || downloadOk, SHARE: isOwner || shareOk },
    rights,
  });
});

// GET /api/content/:id/view -> requires VIEW (owner always passes)
const viewContent = asyncHandler(async (req, res) => {
  const contentId = Number(req.params.id);
  const content = await getContentById(contentId);
  if (!content) throw new ApiError(404, 'Content not found.');

  const isOwner = content.owner_id === req.user.userId;
  const allowed = isOwner || (await hasActiveRight(req.user.userId, contentId, 'VIEW'));
  if (!allowed) throw new ApiError(403, 'You do not have VIEW permission for this content.');

  const absolutePath = path.resolve(PROJECT_ROOT, content.file_path);
  if (!absolutePath.startsWith(path.resolve(UPLOAD_DIR)) && !absolutePath.includes(`${path.sep}uploads${path.sep}`)) {
    throw new ApiError(500, 'Stored file path is invalid.');
  }
  if (!fs.existsSync(absolutePath)) {
    throw new ApiError(404, 'The underlying file is missing from storage.');
  }

  await logActivity({ contentId, actorId: req.user.userId, action: 'CONTENT_VIEWED', details: 'Viewed content' });

  res.setHeader('Content-Disposition', `inline; filename="${content.original_filename}"`);
  res.sendFile(absolutePath);
});

// GET /api/content/:id/download -> requires DOWNLOAD (owner always passes)
const downloadContent = asyncHandler(async (req, res) => {
  const contentId = Number(req.params.id);
  const content = await getContentById(contentId);
  if (!content) throw new ApiError(404, 'Content not found.');

  const isOwner = content.owner_id === req.user.userId;
  const allowed = isOwner || (await hasActiveRight(req.user.userId, contentId, 'DOWNLOAD'));
  if (!allowed) throw new ApiError(403, 'You do not have DOWNLOAD permission for this content.');

  const absolutePath = path.resolve(PROJECT_ROOT, content.file_path);
  if (!fs.existsSync(absolutePath)) {
    throw new ApiError(404, 'The underlying file is missing from storage.');
  }

  await logActivity({ contentId, actorId: req.user.userId, action: 'CONTENT_DOWNLOADED', details: 'Downloaded content' });

  res.download(absolutePath, content.original_filename);
});

// GET /api/content/:id/verify -> recompute SHA-256 and compare
const verifyIntegrity = asyncHandler(async (req, res) => {
  const contentId = Number(req.params.id);
  const content = await getContentById(contentId);
  if (!content) throw new ApiError(404, 'Content not found.');

  const isOwner = content.owner_id === req.user.userId;
  const canAccess =
    isOwner ||
    (await hasActiveRight(req.user.userId, contentId, 'VIEW')) ||
    (await hasActiveRight(req.user.userId, contentId, 'DOWNLOAD'));
  if (!canAccess) throw new ApiError(403, 'You do not have access to this content.');

  const absolutePath = path.resolve(PROJECT_ROOT, content.file_path);
  if (!fs.existsSync(absolutePath)) {
    return res.json({ status: 'MISSING', storedHash: content.file_hash, currentHash: null });
  }

  const currentHash = await sha256File(absolutePath);
  const status = currentHash === content.file_hash ? 'VERIFIED' : 'MODIFIED';

  res.json({ status, storedHash: content.file_hash, currentHash });
});

// GET /api/content/catalog -> all published content in marketplace with purchase status for the user
const listCatalogContent = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT 
        c.content_id, c.title, c.original_filename, c.file_size, c.upload_timestamp, c.file_hash,
        u.name AS owner_name, u.user_id AS owner_id,
        GROUP_CONCAT(DISTINCT r.right_type) AS user_rights
     FROM content c
     JOIN users u ON u.user_id = c.owner_id
     LEFT JOIN rights r ON r.content_id = c.content_id AND r.user_id = ? AND r.status = 'ACTIVE'
     GROUP BY c.content_id, c.title, c.original_filename, c.file_size, c.upload_timestamp, c.file_hash, u.name, u.user_id
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
  const contentId = Number(req.params.id);
  const { rightType = 'VIEW' } = req.body;
  const content = await getContentById(contentId);
  if (!content) throw new ApiError(404, 'Content not found.');

  if (content.owner_id === req.user.userId) {
    throw new ApiError(400, 'You already own this content with full administrative rights.');
  }

  const validTypes = ['VIEW', 'DOWNLOAD'];
  const typeToGrant = validTypes.includes(rightType.toUpperCase()) ? rightType.toUpperCase() : 'VIEW';

  // Check if right already exists
  const [existing] = await pool.query(
    'SELECT right_id, status FROM rights WHERE content_id = ? AND user_id = ? AND right_type = ?',
    [contentId, req.user.userId, typeToGrant]
  );

  if (existing.length > 0) {
    if (existing[0].status === 'ACTIVE') {
      return res.json({ message: `You already hold active ${typeToGrant} license for this file.` });
    }
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

  await logActivity({
    contentId,
    actorId: req.user.userId,
    targetUserId: req.user.userId,
    action: 'RIGHT_ACQUIRED',
    details: `Purchased ${typeToGrant} license for "${content.title}"`,
  });

  res.status(201).json({ message: `Successfully acquired ${typeToGrant} license!` });
});

// GET /api/content/moderator/all -> all content across platform for moderator
const listAllContentModerator = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT 
        c.content_id, c.title, c.original_filename, c.stored_filename, c.file_size, c.file_hash, c.upload_timestamp,
        u.user_id AS owner_id, u.name AS owner_name, u.email AS owner_email,
        COUNT(DISTINCT CASE WHEN r.status = 'ACTIVE' THEN r.right_id END) AS active_rights_count
     FROM content c
     JOIN users u ON u.user_id = c.owner_id
     LEFT JOIN rights r ON r.content_id = c.content_id
     GROUP BY c.content_id, c.title, c.original_filename, c.stored_filename, c.file_size, c.file_hash, c.upload_timestamp, u.user_id, u.name, u.email
     ORDER BY c.upload_timestamp DESC`
  );
  res.json(rows);
});

// GET /api/content/moderator/verify-all -> batch scan all stored files and check SHA-256 integrity
const verifyAllIntegrity = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT content_id, title, original_filename, file_path, file_hash FROM content ORDER BY content_id'
  );
  const results = [];
  let verifiedCount = 0;
  let modifiedCount = 0;
  let missingCount = 0;

  for (const item of rows) {
    const absolutePath = path.resolve(PROJECT_ROOT, item.file_path);
    if (!fs.existsSync(absolutePath)) {
      results.push({ content_id: item.content_id, title: item.title, status: 'MISSING' });
      missingCount++;
    } else {
      const currentHash = await sha256File(absolutePath);
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
