require('dotenv').config();
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { pool } = require('../src/config/db');
const { PROJECT_ROOT, UPLOAD_DIR, BACKEND_ROOT } = require('../src/config/paths');
const { encryptBuffer, decryptBuffer, getKek } = require('../src/services/encryptionService');

const apply = process.argv.includes('--apply');
const BACKUP_DIR = path.join(BACKEND_ROOT, 'legacy-backups');

function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

async function main() {
  if (apply) getKek();
  const [rows] = await pool.query(
    `SELECT content_id, file_path, file_hash, encryption_status, kek_version FROM content ORDER BY content_id`
  );
  const summary = { mode: apply ? 'apply' : 'dry-run', inspected: rows.length, eligible: rows.filter((row) => row.encryption_status !== 'ENCRYPTED').length, converted: 0, skipped: 0, failed: 0, unresolved: [], failures: [] };
  for (const row of rows) {
    let encryptedPath;
    let tempPath;
    let sourcePath;
    let backupPath;
    let movedToBackup = false;
    try {
      if (row.encryption_status === 'ENCRYPTED') { summary.skipped++; continue; }
      if (!row.file_path || path.isAbsolute(row.file_path)) throw new Error('stored path is not a safe project-relative path');
      const source = path.resolve(PROJECT_ROOT, row.file_path);
      const uploadRoot = path.resolve(UPLOAD_DIR);
      if (!isWithin(uploadRoot, source)) throw new Error('stored file is outside the configured uploads directory');
      sourcePath = source;
      const digestSuffix = String(row.file_hash).slice(0, 16);
      backupPath = path.join(BACKUP_DIR, `content-${row.content_id}-${digestSuffix}.legacy`);
      const actualSource = await fs.realpath(source).catch(async (error) => {
        // A prior run may have atomically moved the fixture to its protected
        // backup before stopping. Reuse that recoverable source on retry.
        if (error.code === 'ENOENT' && await fs.stat(backupPath).then(() => true, () => false)) {
          movedToBackup = true;
          return fs.realpath(backupPath);
        }
        throw error;
      });
      const actualUploadRoot = await fs.realpath(UPLOAD_DIR);
      if (!movedToBackup && !isWithin(actualUploadRoot, actualSource)) throw new Error('stored file resolves outside the configured uploads directory');
      if (movedToBackup && !isWithin(await fs.realpath(BACKUP_DIR), actualSource)) throw new Error('recovery backup resolves outside the protected backup directory');
      const inputPath = movedToBackup ? backupPath : source;
      const original = await fs.readFile(inputPath);
      const hash = crypto.createHash('sha256').update(original).digest('hex');
      if (hash !== String(row.file_hash).toLowerCase()) throw new Error('legacy plaintext hash does not match database');
      if (!apply) { summary.skipped++; continue; }
      const encrypted = encryptBuffer(original);
      const restored = decryptBuffer(encrypted.ciphertext, encrypted.metadata);
      if (!restored.equals(original) || crypto.createHash('sha256').update(restored).digest('hex') !== hash) throw new Error('encrypted copy failed round-trip verification');
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const fileToken = crypto.randomBytes(12).toString('hex');
      tempPath = path.join(UPLOAD_DIR, `.convert-${row.content_id}-${fileToken}.partial`);
      encryptedPath = path.join(UPLOAD_DIR, `content-${row.content_id}-${fileToken}.drm`);
      await fs.writeFile(tempPath, encrypted.ciphertext, { flag: 'wx', mode: 0o600 });
      await fs.rename(tempPath, encryptedPath);
      tempPath = null;
      const storedCiphertext = await fs.readFile(encryptedPath);
      const verifiedCopy = decryptBuffer(storedCiphertext, encrypted.metadata);
      if (!verifiedCopy.equals(original) || crypto.createHash('sha256').update(verifiedCopy).digest('hex') !== hash) throw new Error('stored ciphertext failed read-back verification');

      await fs.mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 });
      if (!movedToBackup) {
        await fs.rename(source, backupPath);
        movedToBackup = true;
      }
      const relativePath = path.relative(PROJECT_ROOT, encryptedPath);
      const [updated] = await pool.query(
        `UPDATE content SET stored_filename = ?, file_path = ?, encryption_status = 'ENCRYPTED', encrypted_dek = ?,
           kek_nonce = ?, kek_auth_tag = ?, content_nonce = ?, content_auth_tag = ?, encrypted_file_hash = ?, kek_version = ?
         WHERE content_id = ? AND (encryption_status IS NULL OR encryption_status <> 'ENCRYPTED') AND file_hash = ?`,
        [path.basename(encryptedPath), relativePath, encrypted.metadata.encryptedDek, encrypted.metadata.wrapIv,
          encrypted.metadata.wrapTag, encrypted.metadata.contentIv, encrypted.metadata.contentTag,
          encrypted.metadata.encryptedHash, encrypted.metadata.keyVersion, row.content_id, row.file_hash]
      );
      if (!updated.affectedRows) {
        const [current] = await pool.query('SELECT encryption_status FROM content WHERE content_id = ?', [row.content_id]);
        if (current[0]?.encryption_status === 'ENCRYPTED') {
          await fs.unlink(encryptedPath).catch(() => {});
          encryptedPath = null;
          summary.skipped++;
          continue;
        }
        throw new Error('database metadata was not updated; original remains in the protected backup for recovery');
      }
      encryptedPath = null;
      summary.converted++;
      console.log(`converted content_id=${row.content_id}; backup=${path.relative(PROJECT_ROOT, backupPath)}`);
    } catch (err) {
      if (tempPath) await fs.unlink(tempPath).catch(() => {});
      if (encryptedPath) await fs.unlink(encryptedPath).catch(() => {});
      if (movedToBackup && sourcePath && backupPath) {
        const [current] = await pool.query('SELECT encryption_status FROM content WHERE content_id = ?', [row.content_id]).catch(() => [[]]);
        if (current[0]?.encryption_status !== 'ENCRYPTED') {
          await fs.rename(backupPath, sourcePath).catch((restoreError) => {
            summary.unresolved.push({ contentId: row.content_id, backup: path.relative(PROJECT_ROOT, backupPath), reason: restoreError.message });
          });
        }
      }
      summary.failed++;
      summary.failures.push({ contentId: row.content_id, reason: err.message });
      if (err.code === 'ENOENT') summary.unresolved.push({ contentId: row.content_id, filePath: row.file_path, reason: 'Source file is missing and no known conversion backup was found.' });
    }
  }
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failures.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Legacy conversion could not start:', err.message);
  process.exitCode = 1;
}).finally(async () => pool.end());
