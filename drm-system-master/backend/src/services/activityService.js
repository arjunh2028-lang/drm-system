const { pool } = require('../config/db');

/**
 * Record a row in activity_log. Used for events that are NOT already
 * covered by the rights triggers in the database (e.g. uploads, views,
 * downloads). contentId / targetUserId may be null.
 */
async function logActivity({ contentId = null, actorId = null, targetUserId = null, action, details = null }) {
  await pool.query(
    `INSERT INTO activity_log (content_id, actor_id, target_user_id, action, details)
     VALUES (?, ?, ?, ?, ?)`,
    [contentId, actorId, targetUserId, action, details]
  );
}

/**
 * Fetch activity / access logs.
 * By default (scope === 'user'), returns strictly user-specific logs where:
 *   a.actor_id = userId OR a.target_user_id = userId
 * If scope === 'content', returns logs for content owned by userId (c.owner_id = userId).
 * If role === 'MODERATOR', can view all logs (scope === 'all') or filter by specific targetUserId.
 */
async function getHistory({ userId = null, role = null, scope = 'user', targetUserId = null, limit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

  let sql = `
    SELECT
      a.activity_id,
      a.action,
      a.details,
      a.created_at,
      a.content_id,
      c.title            AS content_title,
      c.owner_id         AS content_owner_id,
      a.actor_id,
      actor.name          AS actor_name,
      actor.email         AS actor_email,
      actor.role          AS actor_role,
      a.target_user_id,
      target.name         AS target_user_name,
      target.email        AS target_user_email,
      target.role         AS target_user_role
    FROM activity_log a
    LEFT JOIN content c    ON c.content_id = a.content_id
    LEFT JOIN users actor  ON actor.user_id = a.actor_id
    LEFT JOIN users target ON target.user_id = a.target_user_id
  `;
  const params = [];

  if (role === 'MODERATOR' && targetUserId) {
    // Moderator inspecting a specific user's access logs
    sql += ' WHERE (a.actor_id = ? OR a.target_user_id = ?)';
    params.push(targetUserId, targetUserId);
  } else if (role === 'MODERATOR' && scope === 'all') {
    // Moderator viewing all system logs (excluding deleted/orphaned records)
    sql += ' WHERE a.actor_id IS NOT NULL';
  } else if (scope === 'content' && userId) {
    // Creator viewing access events specifically on content they own
    sql += ' WHERE c.owner_id = ?';
    params.push(userId);
  } else if (userId) {
    // User-specific by default: actions performed by or targeted directly to the user
    sql += ' WHERE (a.actor_id = ? OR a.target_user_id = ?)';
    params.push(userId, userId);
  }

  sql += ' ORDER BY a.created_at DESC LIMIT ?';
  params.push(safeLimit);

  const [rows] = await pool.query(sql, params);
  return rows;
}

module.exports = { logActivity, getHistory };
