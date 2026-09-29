const { pool } = require('../src/config/db');

async function migrate() {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM users LIKE 'role'");
    if (cols.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN role ENUM('CREATOR', 'CONSUMER', 'MODERATOR') NOT NULL DEFAULT 'CONSUMER'");
      console.log('Added role column to users table.');
    } else {
      console.log('Role column already exists.');
    }

    await pool.query("UPDATE users SET role = 'CREATOR' WHERE email = 'alice@example.com'");
    await pool.query("UPDATE users SET role = 'CONSUMER' WHERE email = 'bob@example.com'");
    await pool.query("UPDATE users SET role = 'MODERATOR' WHERE email = 'carol@example.com'");
    console.log('User roles updated.');

    const [users] = await pool.query('SELECT user_id, name, email, role FROM users');
    console.log('Current users:', users);
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
