const crypto = require('crypto');
const fs = require('fs/promises');
const keyProvider = require('./keyProvider');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

function getKek(version) { return keyProvider.getKey(version); }

function validateKey(key) {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) throw new Error('Invalid encryption key.');
}

function encryptBuffer(plaintext, kek = getKek(), keyVersion = keyProvider.getActiveVersion()) {
  validateKey(kek);
  const dek = crypto.randomBytes(KEY_BYTES);
  const contentIv = crypto.randomBytes(IV_BYTES);
  const contentCipher = crypto.createCipheriv(ALGORITHM, dek, contentIv);
  const ciphertext = Buffer.concat([contentCipher.update(plaintext), contentCipher.final()]);
  const contentTag = contentCipher.getAuthTag();
  const wrapIv = crypto.randomBytes(IV_BYTES);
  const wrapper = crypto.createCipheriv(ALGORITHM, kek, wrapIv);
  const wrappedDek = Buffer.concat([wrapper.update(dek), wrapper.final()]);
  return {
    ciphertext,
    metadata: {
      encryptedDek: wrappedDek.toString('base64'),
      wrapIv: wrapIv.toString('base64'),
      wrapTag: wrapper.getAuthTag().toString('base64'),
      contentIv: contentIv.toString('base64'),
      contentTag: contentTag.toString('base64'),
      encryptedHash: crypto.createHash('sha256').update(ciphertext).digest('hex'),
      keyVersion,
    },
  };
}

function unwrapDek(metadata, kek) {
  validateKey(kek);
  const decode = (value, length, name) => {
    if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error(`Invalid ${name}.`);
    const result = Buffer.from(value, 'base64');
    if (result.length !== length || result.toString('base64') !== value) throw new Error(`Invalid ${name}.`);
    return result;
  };
  const wrapper = crypto.createDecipheriv(ALGORITHM, kek, decode(metadata.wrapIv, IV_BYTES, 'key-wrap nonce'));
  wrapper.setAuthTag(decode(metadata.wrapTag, 16, 'key-wrap authentication tag'));
  const dek = Buffer.concat([wrapper.update(decode(metadata.encryptedDek, KEY_BYTES, 'wrapped data key')), wrapper.final()]);
  validateKey(dek);
  return dek;
}

function decryptBuffer(ciphertext, metadata, kek = getKek(metadata?.keyVersion || 'v1')) {
  validateKey(kek);
  const decode = (value, length, name) => {
    if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error(`Invalid ${name}.`);
    const result = Buffer.from(value, 'base64');
    if (result.length !== length || result.toString('base64') !== value) throw new Error(`Invalid ${name}.`);
    return result;
  };
  const encryptedHash = crypto.createHash('sha256').update(ciphertext).digest('hex');
  if (!metadata?.encryptedHash || encryptedHash !== metadata.encryptedHash.toLowerCase()) throw new Error('Encrypted file integrity check failed.');
  const dek = unwrapDek(metadata, kek);
  const decipher = crypto.createDecipheriv(ALGORITHM, dek, decode(metadata.contentIv, IV_BYTES, 'content nonce'));
  decipher.setAuthTag(decode(metadata.contentTag, 16, 'content authentication tag'));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function rewrapDek(metadata, sourceKek, targetKek, targetVersion) {
  validateKey(targetKek);
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(targetVersion || '')) throw new Error('Invalid target KEK version.');
  const dek = unwrapDek(metadata, sourceKek);
  const wrapIv = crypto.randomBytes(IV_BYTES);
  const wrapper = crypto.createCipheriv(ALGORITHM, targetKek, wrapIv);
  const wrapped = Buffer.concat([wrapper.update(dek), wrapper.final()]);
  const rotated = {
    ...metadata,
    encryptedDek: wrapped.toString('base64'),
    wrapIv: wrapIv.toString('base64'),
    wrapTag: wrapper.getAuthTag().toString('base64'),
    keyVersion: targetVersion,
  };
  unwrapDek(rotated, targetKek);
  return rotated;
}

async function encryptFile(sourcePath, targetPath, kek = getKek()) {
  const plain = await fs.readFile(sourcePath);
  const encrypted = encryptBuffer(plain, kek);
  await fs.writeFile(targetPath, encrypted.ciphertext, { flag: 'wx', mode: 0o600 });
  return encrypted.metadata;
}

async function decryptFile(filePath, metadata, kek = getKek(metadata?.keyVersion || 'v1')) {
  return decryptBuffer(await fs.readFile(filePath), metadata, kek);
}

function validateConfiguration() { keyProvider.validateConfiguration(); }

module.exports = { ALGORITHM, encryptBuffer, decryptBuffer, encryptFile, decryptFile, getKek, rewrapDek, validateConfiguration };
