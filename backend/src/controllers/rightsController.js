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

// GET /api/content/:id/rights
const listRights = asyncHandler(async (req, res) => {
  const contentId = Number(req.params.id);
  const content = await getContentById(contentId);
  if (!content) throw new ApiError(404, 'Content not found.');

  const isOwner = content.owner_id === req.user.userId;
  const canManage = await canManageRights(req.user.userId, contentId);
  if (!isOwner && !canManage) {
    throw new ApiError(403, 'You are not authorized to view rights for this content.');
  }

  const rights = await getRightsForContent(contentId);
  res.json(rights);
});

// POST /api/content/:id/rights   body: { userId, rightType }
const grantRight = asyncHandler(async (req, res) => {
  const contentId = Number(req.params.id);
  const { userId, rightType } = req.body;

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

  if (Number(userId) === content.owner_id) {
    throw new ApiError(400, 'The owner already has all rights over their own content.');
  }

  const [targetUser] = await pool.query('SELECT user_id FROM users WHERE user_id = ?', [userId]);
  if (targetUser.length === 0) {
    throw new ApiError(404, 'Target user not found.');
  }

  // sp_grant_right is idempotent: inserts a new row, or flips an
  // existing REVOKED row for this (content, user, right) back to ACTIVE.
  await pool.query('CALL sp_grant_right(?, ?, ?, ?)', [contentId, userId, rightType, req.user.userId]);
  // Note: the RIGHT_GRANTED activity_log entry is written automatically
  // by the trg_rights_after_insert / trg_rights_after_update triggers.

  res.status(201).json({ message: `${rightType} granted successfully.` });
});

// DELETE /api/content/:id/rights/:rightId
const revokeRight = asyncHandler(async (req, res) => {
  const contentId = Number(req.params.id);
  const rightId = Number(req.params.rightId);

  const content = await getContentById(contentId);
  if (!content) throw new ApiError(404, 'Content not found.');

  const allowed = await canManageRights(req.user.userId, contentId);
  if (!allowed) {
    throw new ApiError(403, 'Only the owner or a user with SHARE rights can revoke permissions.');
  }

  const [rows] = await pool.query(
    'SELECT right_id, status FROM rights WHERE right_id = ? AND content_id = ?',
    [rightId, contentId]
  );
  if (rows.length === 0) throw new ApiError(404, 'Right not found for this content.');
  if (rows[0].status === 'REVOKED') throw new ApiError(400, 'That right has already been revoked.');

  await pool.query('CALL sp_revoke_right(?, ?)', [rightId, req.user.userId]);
  // The activity_log entry for RIGHT_REVOKED is written by the trigger.

  res.json({ message: 'Right revoked successfully.' });
});

// GET /api/rights/mine -> all ACTIVE rights the current user holds
// (used by the "Rights I Have" section of the dashboard / accessible page)
const myRights = asyncHandler(async (req, res) => {
  const rows = await getRightsForUser(req.user.userId);
  res.json(rows);
});

module.exports = { listRights, grantRight, revokeRight, myRights };
