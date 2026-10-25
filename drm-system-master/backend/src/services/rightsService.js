const { pool } = require('../config/db');

const VALID_RIGHT_TYPES = ['VIEW', 'DOWNLOAD', 'SHARE'];

async function getContentById(contentId) {
  const [rows] = await pool.query(
    `SELECT c.*, u.user_id AS owner_id, u.name AS owner_name, u.email AS owner_email
       FROM content c JOIN users u ON u.user_id = c.owner_id WHERE c.content_id = ?`,
    [contentId]
  );
  return rows[0] || null;
}

// The owner implicitly has every right over their own content.
async function hasActiveRight(userId, contentId, rightType) {
  const content = await getContentById(contentId);
  if (!content) return false;
  if (content.owner_id === userId) return true;

  const [rows] = await pool.query(
    `SELECT 1 FROM rights r
      WHERE r.content_id = ? AND r.user_id = ? AND r.right_type = ? AND r.status = 'ACTIVE'
        AND (NOT EXISTS (SELECT 1 FROM blockchain_assets ba WHERE ba.content_id = r.content_id AND ba.status = 'CONFIRMED')
          OR EXISTS (SELECT 1 FROM blockchain_rights br WHERE br.right_id = r.right_id AND br.status = 'CONFIRMED'
            AND (br.expiration_timestamp IS NULL OR br.expiration_timestamp = 0 OR br.expiration_timestamp > UNIX_TIMESTAMP())))
      LIMIT 1`,
    [contentId, userId, rightType]
  );
  return rows.length > 0;
}

// Owner can always manage rights. A non-owner can also grant/revoke
// rights on content if they hold an ACTIVE SHARE right for it.
async function canManageRights(userId, contentId) {
  const content = await getContentById(contentId);
  if (!content) return false;
  if (content.owner_id === userId) return true;
  return hasActiveRight(userId, contentId, 'SHARE');
}

// All rights (active + revoked history) currently recorded for a piece
// of content, with human-readable user names attached.
async function getRightsForContent(contentId) {
  const [rows] = await pool.query(
    `SELECT
        r.right_id, r.content_id, r.user_id, u.name AS user_name, u.email AS user_email,
        r.right_type, r.granted_by, gb.name AS granted_by_name,
        r.granted_timestamp,
        CASE WHEN r.status = 'ACTIVE' AND br.expiration_timestamp IS NOT NULL AND br.expiration_timestamp > 0
          AND br.expiration_timestamp <= UNIX_TIMESTAMP() THEN 'EXPIRED' ELSE r.status END AS status,
        r.revoked_by, r.revoked_timestamp,
        br.expiration_timestamp AS license_expires_at,
        br.transaction_hash AS blockchain_transaction_hash
     FROM rights r
     LEFT JOIN blockchain_rights br ON br.right_id = r.right_id
     JOIN users u  ON u.user_id = r.user_id
     JOIN users gb ON gb.user_id = r.granted_by
     WHERE r.content_id = ?
     ORDER BY r.granted_timestamp DESC`,
    [contentId]
  );
  return rows;
}

// Rights the given user currently holds (as a non-owner) across all
// content, i.e. "content shared with me".
async function getRightsForUser(userId) {
  const [rows] = await pool.query(
    `SELECT
        r.right_id, r.content_id, c.title AS content_title,
        r.right_type, r.status, r.granted_timestamp,
        owner.user_id AS owner_id, owner.name AS owner_name
     FROM rights r
     JOIN content c ON c.content_id = r.content_id
     JOIN users owner ON owner.user_id = c.owner_id
     WHERE r.user_id = ? AND r.status = 'ACTIVE'
       AND (NOT EXISTS (SELECT 1 FROM blockchain_assets ba WHERE ba.content_id = r.content_id AND ba.status = 'CONFIRMED')
         OR EXISTS (SELECT 1 FROM blockchain_rights br WHERE br.right_id = r.right_id AND br.status = 'CONFIRMED'
           AND (br.expiration_timestamp IS NULL OR br.expiration_timestamp = 0 OR br.expiration_timestamp > UNIX_TIMESTAMP())))
     ORDER BY r.granted_timestamp DESC`,
    [userId]
  );
  return rows;
}

module.exports = {
  VALID_RIGHT_TYPES,
  getContentById,
  hasActiveRight,
  canManageRights,
  getRightsForContent,
  getRightsForUser,
};
