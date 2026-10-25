const path = require('path');
const ApiError = require('../utils/ApiError');

function validUtf8(data) {
  const input = data.toString('utf8');
  return Buffer.from(input, 'utf8').compare(data) === 0 ? input : null;
}

function parseCsv(input, limits = {}) {
  const maxRows = limits.maxRows || 20000;
  const maxColumns = limits.maxColumns || 1000;
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; afterQuote = true; }
      else field += char;
    } else if (char === ',' || char === '\n' || char === '\r') {
      if (afterQuote && char !== ',' && char !== '\n' && char !== '\r') throw new Error('Invalid CSV syntax.');
      row.push(field); field = ''; afterQuote = false;
      if (row.length > maxColumns) throw new ApiError(413, 'CSV preview exceeds the supported column limit.');
      if (char !== ',') {
        if (char === '\r' && input[i + 1] === '\n') i++;
        rows.push(row); row = [];
        if (rows.length > maxRows) throw new ApiError(413, 'CSV preview exceeds the supported row limit.');
      }
    } else if (char === '"' && field.length === 0 && !afterQuote) quoted = true;
    else if (char === '"') throw new Error('Invalid CSV syntax.');
    else if (afterQuote) throw new Error('Invalid CSV syntax.');
    else field += char;
  }
  if (quoted) throw new Error('Invalid CSV syntax: unterminated quoted field.');
  if (field.length || row.length || afterQuote || input.endsWith(',')) row.push(field);
  if (row.length) rows.push(row);
  if (rows.length > maxRows || row.length > maxColumns) throw new ApiError(413, 'CSV preview exceeds the supported size.');
  return rows;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function renderCsvPreview(input, content, user, date) {
  if (Buffer.byteLength(input) > 5 * 1024 * 1024) throw new ApiError(413, 'CSV protected preview is limited to 5 MiB.');
  let rows;
  try { rows = parseCsv(input); } catch (err) {
    if (err.statusCode) throw err;
    throw new ApiError(422, 'CSV is malformed and cannot be rendered safely.');
  }
  const identifier = Number.isSafeInteger(Number(user.userId)) ? `Account ${Number(user.userId)}` : 'Authorized account';
  const attribution = `${identifier} · Asset ${content.content_id} · ${date.toISOString()}`;
  const table = rows.map((cells) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell).replace(/\r\n?|\n/g, '<br>')}</td>`).join('')}</tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Protected CSV preview</title></head><body><header><strong>Licensed preview — ${escapeHtml(attribution)}</strong><p>Watermarked display only. The original CSV is available only through DOWNLOAD permission.</p></header><table>${table}</table></body></html>`;
  return { data: Buffer.from(html, 'utf8'), applied: true, contentType: 'text/html; charset=utf-8' };
}

function watermarkText(data, content, user, date = new Date()) {
  const extension = path.extname(content.original_filename || '').toLowerCase();
  if (!['.txt', '.csv'].includes(extension)) return { data, applied: false };
  const input = validUtf8(data);
  if (input === null) throw new ApiError(415, 'Protected text viewing requires UTF-8 content.');
  if (extension === '.csv') return renderCsvPreview(input, content, user, date);
  const account = Number.isSafeInteger(Number(user.userId)) ? `ACCOUNT ${Number(user.userId)}` : 'AUTHORIZED ACCOUNT';
  const label = `LICENSED VIEW | ${account} | ASSET ${content.content_id} | ${date.toISOString()}`;
  return { data: Buffer.from(`${label}\n\n${input}`, 'utf8'), applied: true, contentType: 'text/plain; charset=utf-8' };
}

module.exports = { watermarkText, parseCsv, renderCsvPreview };
