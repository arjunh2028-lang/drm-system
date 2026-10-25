const test = require('node:test');
const assert = require('node:assert/strict');
const { watermarkText } = require('../src/services/watermarkService');

test('watermarks supported UTF-8 text with trusted user, asset, and timestamp without mutating original bytes', () => {
  const original = Buffer.from('confidential notes\n');
  const before = Buffer.from(original);
  const result = watermarkText(original, { content_id: 42, original_filename: 'notes.txt' }, { userId: 7, name: 'A\nUser' }, new Date('2026-01-02T03:04:05.000Z'));
  assert.equal(result.applied, true);
  assert.match(result.data.toString(), /^LICENSED VIEW \| ACCOUNT 7 \| ASSET 42 \| 2026-01-02T03:04:05.000Z/);
  assert.ok(result.data.toString().endsWith('confidential notes\n'));
  assert.deepEqual(original, before);
});

test('unsupported and binary files are explicitly returned without a claimed watermark', () => {
  const original = Buffer.from([0, 255, 1]);
  const unsupported = watermarkText(original, { content_id: 1, original_filename: 'picture.png' }, { name: 'User' });
  assert.equal(unsupported.applied, false);
  assert.deepEqual(unsupported.data, original);
  assert.throws(() => watermarkText(original, { content_id: 1, original_filename: 'text.txt' }, { userId: 1 }), /UTF-8/);
});

test('CSV view is a valid escaped HTML preview and does not prepend bytes to the authoritative CSV', () => {
  const original = Buffer.from('name,note\r\nAlice,"hello, world"\r\nBob,"line 1\nline 2"\r\n');
  const before = Buffer.from(original);
  const result = watermarkText(original, { content_id: 5, original_filename: 'list.csv' }, { userId: 2 }, new Date('2026-03-04T00:00:00.000Z'));
  const html = result.data.toString();
  assert.equal(result.contentType, 'text/html; charset=utf-8');
  assert.match(html, /Account 2 · Asset 5/);
  assert.match(html, /hello, world/);
  assert.match(html, /line 1<br>line 2/);
  assert.deepEqual(original, before);
  assert.equal(html.startsWith('name,note'), false);
});

test('malformed CSV is rejected without returning the original data', () => {
  assert.throws(() => watermarkText(Buffer.from('a,"unclosed'), { content_id: 1, original_filename: 'bad.csv' }, { userId: 3 }), /malformed/);
});
