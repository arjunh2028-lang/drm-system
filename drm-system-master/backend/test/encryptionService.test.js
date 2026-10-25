const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { encryptBuffer, decryptBuffer, encryptFile, decryptFile, getKek } = require('../src/services/encryptionService');

const kek = crypto.randomBytes(32);
const plaintext = Buffer.from('private DRM test payload');

test('AES-256-GCM envelope encryption round trips and ciphertext differs from plaintext', () => {
  const encrypted = encryptBuffer(plaintext, kek);
  assert.notDeepEqual(encrypted.ciphertext, plaintext);
  assert.equal(decryptBuffer(encrypted.ciphertext, encrypted.metadata, kek).toString(), plaintext.toString());
});

test('each asset encryption uses an independent DEK and unique nonces', () => {
  const first = encryptBuffer(plaintext, kek);
  const second = encryptBuffer(plaintext, kek);
  assert.notEqual(first.metadata.encryptedDek, second.metadata.encryptedDek);
  assert.notEqual(first.metadata.contentIv, second.metadata.contentIv);
  assert.notEqual(first.metadata.wrapIv, second.metadata.wrapIv);
});

test('tampered ciphertext and authentication metadata are rejected', () => {
  const encrypted = encryptBuffer(plaintext, kek);
  const changed = Buffer.from(encrypted.ciphertext);
  changed[0] ^= 1;
  assert.throws(() => decryptBuffer(changed, encrypted.metadata, kek), /integrity/);
  const altered = { ...encrypted.metadata, contentTag: Buffer.alloc(16).toString('base64') };
  assert.throws(() => decryptBuffer(encrypted.ciphertext, altered, kek));
});

test('encrypted storage file contains ciphertext and decrypts only after authentication', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'drm-encryption-test-'));
  try {
    const source = path.join(directory, 'plain.bin');
    const stored = path.join(directory, 'asset.drm');
    await fs.writeFile(source, plaintext);
    const metadata = await encryptFile(source, stored, kek);
    const ciphertext = await fs.readFile(stored);
    assert.equal(ciphertext.includes(plaintext), false);
    assert.equal(metadata.encryptedHash, crypto.createHash('sha256').update(ciphertext).digest('hex'));
    assert.equal((await decryptFile(stored, metadata, kek)).toString(), plaintext.toString());
  } finally {
    const tempRoot = path.resolve(os.tmpdir());
    const testPath = path.resolve(directory);
    if (!testPath.startsWith(`${tempRoot}${path.sep}drm-encryption-test-`)) throw new Error('Refusing cleanup outside the generated encryption test directory.');
    await fs.rm(testPath, { recursive: true, force: true });
  }
});

test('malformed nonce and missing or invalid configured KEK fail safely', () => {
  const encrypted = encryptBuffer(plaintext, kek);
  assert.throws(() => decryptBuffer(encrypted.ciphertext, { ...encrypted.metadata, contentIv: 'AA==' }, kek), /nonce/);
  const previous = process.env.CONTENT_KEK_BASE64;
  try {
    delete process.env.CONTENT_KEK_BASE64;
    assert.throws(() => getKek(), /must be configured/);
    process.env.CONTENT_KEK_BASE64 = Buffer.alloc(16).toString('base64');
    assert.throws(() => getKek(), /exactly 32 bytes/);
  } finally {
    if (previous === undefined) delete process.env.CONTENT_KEK_BASE64;
    else process.env.CONTENT_KEK_BASE64 = previous;
  }
});
