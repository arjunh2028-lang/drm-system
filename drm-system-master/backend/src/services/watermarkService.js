const path = require('path');

function watermarkText(data, content, user, date = new Date()) {
  const extension = path.extname(content.original_filename || '').toLowerCase();
  if (!['.txt', '.csv'].includes(extension)) return { data, applied: false };
  const input = data.toString('utf8');
  if (Buffer.from(input, 'utf8').compare(data) !== 0) return { data, applied: false };
  const label = `DRM LICENSED TO ${String(user.name || `USER ${user.userId}`).replace(/[\r\n\x00-\x1f]/g, ' ').slice(0, 100)} | ASSET ${content.content_id} | ${date.toISOString()}`;
  return { data: Buffer.from(`${label}\n${input}`, 'utf8'), applied: true };
}

module.exports = { watermarkText };
