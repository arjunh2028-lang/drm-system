const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

// Requires a valid "Authorization: Bearer <token>" header. On success,
// attaches { userId, name, email } to req.user for downstream handlers.
//
// As a fallback, a `?token=` query parameter is also accepted. This is
// only needed for the content view route, which is opened directly by
// the browser (e.g. in an <iframe> or a new tab) where custom headers
// cannot be attached.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, headerToken] = header.split(' ');
  const token = scheme === 'Bearer' ? headerToken : req.query.token;

  if (!token) {
    return next(new ApiError(401, 'Authentication required. Please log in.'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId: payload.userId, name: payload.name, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    return next(new ApiError(401, 'Invalid or expired session. Please log in again.'));
  }
}

module.exports = { requireAuth };
