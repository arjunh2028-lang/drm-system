const { pool } = require('../config/db');

async function logSecurityEvent({ req, eventType, contentId = null, outcome = 'DENIED', detail = null }) {
  const actorId = Number.isSafeInteger(Number(req?.user?.userId)) ? Number(req.user.userId) : null;
  const safeDetail = String(detail || '').replace(/[\r\n\x00-\x1f]/g, ' ').slice(0, 240);
  try {
    await pool.query(
      'INSERT INTO security_events (actor_id, content_id, event_type, outcome, detail) VALUES (?, ?, ?, ?, ?)',
      [actorId, contentId, eventType.slice(0, 50), outcome, safeDetail || null]
    );
    const threshold = Number(process.env.SUSPICIOUS_ACCESS_THRESHOLD || 10);
    const windowMinutes = Number(process.env.SUSPICIOUS_ACCESS_WINDOW_MINUTES || 15);
    if (outcome === 'DENIED' && actorId && Number.isInteger(threshold) && threshold > 0 && Number.isInteger(windowMinutes) && windowMinutes > 0) {
      const [rows] = await pool.query(
        'SELECT COUNT(*) AS denied_count FROM security_events WHERE actor_id = ? AND outcome = \'DENIED\' AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? MINUTE)',
        [actorId, windowMinutes]
      );
      if (Number(rows[0]?.denied_count) >= threshold) console.warn('[security] Repeated denied access threshold reached', { actorId, count: Number(rows[0].denied_count), windowMinutes });
    }
  } catch (err) {
    console.error('[security] Could not persist security event:', { code: err.code || 'AUDIT_WRITE_FAILED' });
  }
}

module.exports = { logSecurityEvent };
