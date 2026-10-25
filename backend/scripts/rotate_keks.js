require('dotenv').config();
const { pool } = require('../src/config/db');
const { getActiveVersion, getKey } = require('../src/services/keyProvider');
const { rotateWrappedKey } = require('../src/services/keyRotationService');

const apply = process.argv.includes('--apply');

async function main() {
  const targetVersion = getActiveVersion();
  const targetKek = getKey(targetVersion);
  const [rows] = await pool.query(
    `SELECT content_id, encrypted_dek, kek_nonce, kek_auth_tag, content_nonce,
            content_auth_tag, encrypted_file_hash, kek_version
       FROM content WHERE encryption_status = 'ENCRYPTED' AND kek_version <> ?
      ORDER BY content_id`, [targetVersion]
  );
  const report = { mode: apply ? 'apply' : 'dry-run', targetVersion, inspected: rows.length, rotated: 0, skipped: 0, failures: [] };
  for (const row of rows) {
    try {
      const metadata = {
        encryptedDek: row.encrypted_dek, wrapIv: row.kek_nonce, wrapTag: row.kek_auth_tag,
        contentIv: row.content_nonce, contentTag: row.content_auth_tag,
        encryptedHash: row.encrypted_file_hash, keyVersion: row.kek_version,
      };
      const rotated = rotateWrappedKey(metadata, getKey(row.kek_version), targetKek, targetVersion);
      if (!rotated.changed) { report.skipped++; continue; }
      if (!apply) { report.skipped++; continue; }
      const [update] = await pool.query(
        `UPDATE content SET encrypted_dek = ?, kek_nonce = ?, kek_auth_tag = ?, kek_version = ?
          WHERE content_id = ? AND encryption_status = 'ENCRYPTED' AND kek_version = ? AND encrypted_dek = ?`,
        [rotated.metadata.encryptedDek, rotated.metadata.wrapIv, rotated.metadata.wrapTag,
          targetVersion, row.content_id, row.kek_version, row.encrypted_dek]
      );
      if (!update.affectedRows) { report.skipped++; continue; }
      report.rotated++;
    } catch (error) {
      report.failures.push({ contentId: row.content_id, sourceVersion: row.kek_version, reason: error.message });
    }
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[key-rotation] Unable to complete rotation:', error.message);
  process.exitCode = 1;
}).finally(async () => pool.end());
