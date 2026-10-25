const asyncHandler = require('../utils/asyncHandler');
const { getHistory } = require('../services/activityService');

// GET /api/history?limit=50&scope=user|content|all&userId=...
// Returns user-specific access & activity logs by default.
// Moderators can view all logs or filter by specific target user.
const listHistory = asyncHandler(async (req, res) => {
  const currentUserId = req.user.userId;
  const currentRole = req.user.role;
  const { limit, scope, userId } = req.query;

  const defaultScope = currentRole === 'MODERATOR' ? (userId ? 'user' : 'all') : 'user';
  const effectiveScope = scope || defaultScope;

  const rows = await getHistory({
    userId: currentUserId,
    role: currentRole,
    scope: effectiveScope,
    targetUserId: currentRole === 'MODERATOR' && userId ? Number(userId) : null,
    limit,
  });
  res.json(rows);
});

module.exports = { listHistory };
