require('dotenv').config();
const { pool } = require('../src/config/db');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
    [table, column]
  );
  return rows.length > 0;
}

async function main() {
  if (!await columnExists('content', 'kek_version')) {
    await pool.query("ALTER TABLE content ADD COLUMN kek_version VARCHAR(32) NOT NULL DEFAULT 'v1'");
    console.log('added content.kek_version (existing encrypted assets assigned v1)');
  } else console.log('present content.kek_version');

  if (!await columnExists('blockchain_operations', 'operation_key')) {
    await pool.query('ALTER TABLE blockchain_operations ADD COLUMN operation_key CHAR(36) NULL');
    console.log('added blockchain_operations.operation_key');
  } else console.log('present blockchain_operations.operation_key');

  const [indexes] = await pool.query(
    "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'blockchain_operations' AND index_name = 'uq_blockchain_operation_key'"
  );
  if (!indexes.length) {
    await pool.query('CREATE UNIQUE INDEX uq_blockchain_operation_key ON blockchain_operations (operation_key)');
    console.log('added unique operation key index');
  } else console.log('present unique operation key index');

  const [eventIndexes] = await pool.query(
    "SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'security_events' AND index_name = 'idx_security_type_time'"
  );
  if (!eventIndexes.length) {
    await pool.query('CREATE INDEX idx_security_type_time ON security_events (event_type, created_at)');
    console.log('added security event type/time index');
  } else console.log('present security event type/time index');
  console.log('V3 migration complete. No existing content bytes or records were deleted.');
}

main().catch((error) => {
  console.error('[migration] V3 migration failed:', error.message);
  process.exitCode = 1;
}).finally(async () => pool.end());
