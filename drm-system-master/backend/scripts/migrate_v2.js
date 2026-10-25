require('dotenv').config();
const { pool } = require('../src/config/db');

const columns = {
  content: {
    encryption_status: "VARCHAR(20) NOT NULL DEFAULT 'LEGACY'",
    encrypted_dek: 'VARCHAR(100) NULL',
    kek_nonce: 'VARCHAR(32) NULL',
    kek_auth_tag: 'VARCHAR(32) NULL',
    content_nonce: 'VARCHAR(32) NULL',
    content_auth_tag: 'VARCHAR(32) NULL',
    encrypted_file_hash: 'CHAR(64) NULL',
  },
  blockchain_operations: { actor_user_id: 'INT NULL' },
};

async function main() {
  for (const [table, definitions] of Object.entries(columns)) {
    for (const [column, definition] of Object.entries(definitions)) {
      const [found] = await pool.query(
        'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
        [table, column]
      );
      if (!found.length) {
        await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
        console.log(`added ${table}.${column}`);
      } else console.log(`present ${table}.${column}`);
    }
  }
  const [foreignKey] = await pool.query(
    `SELECT 1 FROM information_schema.key_column_usage WHERE constraint_schema = DATABASE()
     AND table_name = 'blockchain_operations' AND column_name = 'actor_user_id' AND referenced_table_name = 'users'`
  );
  if (!foreignKey.length) {
    await pool.query('ALTER TABLE blockchain_operations ADD CONSTRAINT fk_blockchain_operation_actor_v2 FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL');
    console.log('added blockchain_operations actor foreign key');
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS security_events (
    security_event_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_id INT NULL,
    content_id INT NULL,
    event_type VARCHAR(50) NOT NULL,
    outcome VARCHAR(20) NOT NULL,
    detail VARCHAR(240) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_security_event_actor FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT fk_security_event_content FOREIGN KEY (content_id) REFERENCES content(content_id) ON DELETE SET NULL,
    CONSTRAINT chk_security_event_outcome CHECK (outcome IN ('ALLOWED', 'DENIED', 'ERROR')),
    INDEX idx_security_actor_time (actor_id, created_at),
    INDEX idx_security_content_time (content_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('V2 migration complete. Existing rows remain LEGACY until converted.');
}

main().catch((err) => {
  console.error('V2 database migration failed:', err.message);
  process.exitCode = 1;
}).finally(async () => pool.end());
