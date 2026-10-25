const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function apply() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'drm_system',
    multipleStatements: true,
  });

  const schemaPath = path.join(__dirname, '../../database/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  // Strip delimiter blocks for base queries
  const baseSql = sql.replace(/DELIMITER \$\$[\s\S]*?DELIMITER ;/g, '');
  console.log('Applying base DDL (tables, views, indexes, foreign keys)...');
  await connection.query(baseSql);
  console.log('Base DDL applied successfully.');

  // Extract DELIMITER blocks (triggers, stored procedures)
  const triggerMatch = sql.match(/DELIMITER \$\$([\s\S]*?)DELIMITER ;/g);
  if (triggerMatch) {
    for (const block of triggerMatch) {
      const cleanBlock = block.replace(/DELIMITER \$\$/g, '').replace(/DELIMITER ;/g, '').trim();
      const stmts = cleanBlock.split(/\$\$\s*/).filter(s => s.trim().length > 0);
      for (const s of stmts) {
        console.log('Executing routine/trigger statement...');
        await connection.query(s.trim());
      }
    }
  }

  console.log('SUCCESS: 3NF Database Schema fully applied to MySQL!');
  await connection.end();
}

apply().catch(err => {
  console.error('FAILED to apply schema:', err);
  process.exit(1);
});
