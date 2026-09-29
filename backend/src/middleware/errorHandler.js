const multer = require('multer');

// 404 handler for unmatched routes.
function notFound(req, res, next) {
  res.status(404).json({ error: 'Route not found.' });
}

// Central error handler. Never leaks stack traces or raw DB errors to
// the client -- logs the full detail server-side instead.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[error]', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File is too large.' });
    }
    return res.status(400).json({ error: err.message });
  }

  if (err && err.isApiError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err && err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'That record already exists.' });
  }

  if (err && (err.message || '').startsWith('File type')) {
    return res.status(400).json({ error: err.message });
  }

  return res.status(500).json({ error: 'Something went wrong on the server.' });
}

module.exports = { notFound, errorHandler };
