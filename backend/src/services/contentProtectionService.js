const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const { UPLOAD_DIR, PROJECT_ROOT } = require('../config/paths');
const { decryptFile, getKek } = require('./encryptionService');
const { hasActiveRight } = require('./rightsService');
const { verifyAccess } = require('./blockchainService');
const { watermarkText } = require('./watermarkService');

function validContentId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError(400, 'Invalid content identifier.');
  return id;
}

function resolveStoredPath(relativePath) {
  if (typeof relativePath !== 'string' || path.isAbsolute(relativePath)) throw new ApiError(500, 'Stored file path is invalid.');
  const candidate = path.resolve(PROJECT_ROOT, relativePath);
  const root = path.resolve(UPLOAD_DIR);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) throw new ApiError(500, 'Stored file path is invalid.');
  return candidate;
}

async function authorizeContentAccess({ content, req, rightType }) {
  const contentId = validContentId(content.content_id);
  const isOwner = Number(content.owner_id) === Number(req.user.userId);
  const allowed = isOwner || await hasActiveRight(req.user.userId, contentId, rightType);
  if (!allowed) throw new ApiError(403, `You do not have ${rightType} permission for this content.`);

  const { pool } = require('../config/db');
  const [assets] = await pool.query('SELECT status, owner_wallet FROM blockchain_assets WHERE content_id = ?', [contentId]);
  if (assets.length && assets[0].status !== 'CONFIRMED') {
    throw new ApiError(503, 'Blockchain asset is not in a confirmed operational state.');
  }
  if (assets.length) {
    const [wallets] = await pool.query('SELECT user_id, wallet_address FROM users WHERE user_id IN (?, ?)', [req.user.userId, content.owner_id]);
    const userWallet = wallets.find((row) => Number(row.user_id) === Number(req.user.userId))?.wallet_address;
    const ownerWallet = wallets.find((row) => Number(row.user_id) === Number(content.owner_id))?.wallet_address;
    if (!userWallet || !ownerWallet || ownerWallet.toLowerCase() !== assets[0].owner_wallet.toLowerCase()) {
      throw new ApiError(403, 'Verified wallets do not match the blockchain asset record.');
    }
    const valid = await verifyAccess(contentId, content.file_hash, ownerWallet, userWallet, rightType, isOwner);
    if (!valid) throw new ApiError(403, `The on-chain ${rightType} license is invalid, expired, revoked, or does not match this asset.`);
  }
  return { isOwner, contentId };
}

async function readAuthorizedContent(content) {
  const filePath = resolveStoredPath(content.file_path);
  let realPath;
  try { realPath = await fs.realpath(filePath); } catch (_) { throw new ApiError(404, 'The underlying file is missing from storage.'); }
  const root = await fs.realpath(UPLOAD_DIR);
  if (!realPath.startsWith(`${root}${path.sep}`)) throw new ApiError(500, 'Stored file path is invalid.');
  if (content.encryption_status !== 'ENCRYPTED') throw new ApiError(503, 'This legacy plaintext asset must be converted before protected delivery is enabled.');
  let plaintext;
  try {
    plaintext = await decryptFile(realPath, {
      encryptedDek: content.encrypted_dek,
      wrapIv: content.kek_nonce,
      wrapTag: content.kek_auth_tag,
      contentIv: content.content_nonce,
      contentTag: content.content_auth_tag,
      encryptedHash: content.encrypted_file_hash,
      keyVersion: content.kek_version || 'v1',
    }, getKek(content.kek_version || 'v1'));
  } catch (_) {
    throw new ApiError(500, 'Protected content failed integrity or authentication verification.');
  }
  const plainHash = crypto.createHash('sha256').update(plaintext).digest('hex');
  if (plainHash !== String(content.file_hash).toLowerCase()) throw new ApiError(500, 'Protected content does not match its registered plaintext hash.');
  return plaintext;
}

module.exports = { validContentId, resolveStoredPath, authorizeContentAccess, readAuthorizedContent, watermarkText };
