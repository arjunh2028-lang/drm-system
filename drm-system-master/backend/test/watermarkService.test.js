const test = require('node:test');
const assert = require('node:assert/strict');
const { watermarkText } = require('../src/services/watermarkService');

test('watermarks supported UTF-8 text with trusted user, asset, and timestamp without mutating original bytes', () => {
  const original = Buffer.from('confidential notes\n');
  const before = Buffer.from(original);
  const result = watermarkText(original, { content_id: 42, original_filename: 'notes.txt' }, { name: 'A\nUser' }, new Date('2026-01-02T03:04:05.000Z'));
  assert.equal(result.applied, true);
  assert.match(result.data.toString(), /^DRM LICENSED TO A User \| ASSET 42 \| 2026-01-02T03:04:05.000Z/);
  assert.ok(result.data.toString().endsWith('confidential notes\n'));
  assert.deepEqual(original, before);
});

test('unsupported and binary files are explicitly returned without a claimed watermark', () => {
  const original = Buffer.from([0, 255, 1]);
  const unsupported = watermarkText(original, { content_id: 1, original_filename: 'picture.png' }, { name: 'User' });
  const binaryText = watermarkText(original, { content_id: 1, original_filename: 'text.txt' }, { name: 'User' });
  assert.equal(unsupported.applied, false);
  assert.equal(binaryText.applied, false);
  assert.deepEqual(unsupported.data, original);
});
