const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

// Requires a valid "Authorization: Bearer <token>" header. On success,
// attaches the verified identity to req.user for downstream handlers.
//
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, headerToken] = header.split(' ');
  const token = scheme === 'Bearer' ? headerToken : null;

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

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You are not authorized to access this resource.'));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
