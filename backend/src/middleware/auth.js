const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { logSecurityEvent } = require('../services/securityAuditService');

// Requires a valid "Authorization: Bearer <token>" header. On success,
// attaches the verified identity to req.user for downstream handlers.
//
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, headerToken] = header.split(' ');
  const token = scheme === 'Bearer' ? headerToken : null;

  if (!token) {
    logSecurityEvent({ req, eventType: 'AUTHENTICATION_REQUIRED', outcome: 'DENIED', detail: 'Protected endpoint requested without a bearer token' }).catch(() => {});
    return next(new ApiError(401, 'Authentication required. Please log in.'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId: payload.userId, name: payload.name, email: payload.email, role: payload.role };
    next();
  } catch (err) {
    logSecurityEvent({ req, eventType: 'AUTHENTICATION_INVALID', outcome: 'DENIED', detail: 'Protected endpoint requested with an invalid or expired token' }).catch(() => {});
    return next(new ApiError(401, 'Invalid or expired session. Please log in again.'));
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logSecurityEvent({ req, eventType: 'ROLE_ACCESS_DENIED', outcome: 'DENIED', detail: 'Role policy denied protected operation' }).catch(() => {});
      return next(new ApiError(403, 'You are not authorized to access this resource.'));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
