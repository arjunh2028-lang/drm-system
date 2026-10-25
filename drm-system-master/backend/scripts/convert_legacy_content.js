require('dotenv').config();
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { pool } = require('../src/config/db');
const { PROJECT_ROOT, UPLOAD_DIR } = require('../src/config/paths');
const { encryptBuffer, decryptBuffer, getKek } = require('../src/services/encryptionService');

const apply = process.argv.includes('--apply');

async function main() {
  if (apply) getKek();
  const [rows] = await pool.query(
    `SELECT content_id, file_path, file_hash, encryption_status FROM content
     WHERE encryption_status IS NULL OR encryption_status <> 'ENCRYPTED' ORDER BY content_id`
  );
  const summary = { mode: apply ? 'apply' : 'dry-run', eligible: rows.length, converted: 0, skipped: 0, failures: [] };
  for (const row of rows) {
    let encryptedPath;
    try {
      if (!row.file_path || path.isAbsolute(row.file_path)) throw new Error('stored path is not a safe project-relative path');
      const source = path.resolve(PROJECT_ROOT, row.file_path);
      const uploadRoot = path.resolve(UPLOAD_DIR);
      if (source === uploadRoot || !source.startsWith(`${uploadRoot}${path.sep}`)) throw new Error('stored file is outside the configured uploads directory');
      const actualSource = await fs.realpath(source);
      const actualUploadRoot = await fs.realpath(UPLOAD_DIR);
      if (!actualSource.startsWith(`${actualUploadRoot}${path.sep}`)) throw new Error('stored file resolves outside the configured uploads directory');
      const original = await fs.readFile(source);
      const hash = crypto.createHash('sha256').update(original).digest('hex');
      if (hash !== String(row.file_hash).toLowerCase()) throw new Error('legacy plaintext hash does not match database');
      if (!apply) { summary.skipped++; continue; }
      const encrypted = encryptBuffer(original);
      const restored = decryptBuffer(encrypted.ciphertext, encrypted.metadata);
      if (!restored.equals(original) || crypto.createHash('sha256').update(restored).digest('hex') !== hash) throw new Error('encrypted copy failed round-trip verification');
      encryptedPath = `${source}.${crypto.randomBytes(8).toString('hex')}.drm`;
      await fs.writeFile(encryptedPath, encrypted.ciphertext, { flag: 'wx', mode: 0o600 });
      const storedCiphertext = await fs.readFile(encryptedPath);
      const verifiedCopy = decryptBuffer(storedCiphertext, encrypted.metadata);
      if (!verifiedCopy.equals(original) || crypto.createHash('sha256').update(verifiedCopy).digest('hex') !== hash) throw new Error('stored ciphertext failed read-back verification');
      const relativePath = path.relative(PROJECT_ROOT, encryptedPath);
      const [updated] = await pool.query(
        `UPDATE content SET stored_filename = ?, file_path = ?, encryption_status = 'ENCRYPTED', encrypted_dek = ?,
           kek_nonce = ?, kek_auth_tag = ?, content_nonce = ?, content_auth_tag = ?, encrypted_file_hash = ?
         WHERE content_id = ? AND (encryption_status IS NULL OR encryption_status <> 'ENCRYPTED') AND file_hash = ?`,
        [path.basename(encryptedPath), relativePath, encrypted.metadata.encryptedDek, encrypted.metadata.wrapIv,
          encrypted.metadata.wrapTag, encrypted.metadata.contentIv, encrypted.metadata.contentTag,
          encrypted.metadata.encryptedHash, row.content_id, row.file_hash]
      );
      if (!updated.affectedRows) {
        await fs.unlink(encryptedPath).catch(() => {});
        encryptedPath = null;
        summary.skipped++;
        continue;
      }
      // Keep the plaintext original as the recoverable backup. Operators must
      // move it to controlled offline storage or explicitly purge it later.
      summary.converted++;
      console.log(`converted content_id=${row.content_id}; plaintext backup retained`);
    } catch (err) {
      if (encryptedPath) await fs.unlink(encryptedPath).catch(() => {});
      summary.failures.push({ contentId: row.content_id, reason: err.message });
    }
  }
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failures.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Legacy conversion could not start:', err.message);
  process.exitCode = 1;
}).finally(async () => pool.end());
