const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'drm_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
});

// Fail fast with a clear message if the DB is unreachable, rather than
// letting every request time out mysteriously.
async function verifyConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('[db] Connected to MySQL database:', process.env.DB_NAME);
  } catch (err) {
    console.error('[db] Failed to connect to MySQL:', err.message);
    console.error('[db] Check your .env DB_* values and that MySQL is running.');
    process.exit(1);
  }
}

module.exports = { pool, verifyConnection };
