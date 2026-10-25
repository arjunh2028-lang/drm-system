function createRateLimiter({ windowMs, max, keyGenerator = (req) => req.ip || req.socket?.remoteAddress || 'unknown', clock = Date.now, onLimit } = {}) {
  if (!Number.isSafeInteger(windowMs) || windowMs < 1 || !Number.isSafeInteger(max) || max < 1) {
    throw new Error('Rate limiter requires positive integer windowMs and max values.');
  }
  const buckets = new Map();
  return function rateLimit(req, res, next) {
    const now = clock();
    const key = String(keyGenerator(req) || 'unknown');
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) bucket = { count: 0, resetAt: now + windowMs };
    if (bucket.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfter));
      const log = onLimit || (() => require('../services/securityAuditService').logSecurityEvent({ req, eventType: 'RATE_LIMIT_EXCEEDED', outcome: 'DENIED', detail: 'Sensitive request rate limit exceeded' }));
      Promise.resolve(log(req)).catch(() => {});
      return res.status(429).json({ error: 'Too many requests. Try again later.' });
    }
    bucket.count++;
    buckets.set(key, bucket);
    if (buckets.size > 10000) {
      for (const [entry, value] of buckets) {
        if (now >= value.resetAt || buckets.size > 8000) buckets.delete(entry);
        if (buckets.size <= 8000) break;
      }
    }
    return next();
  };
}

const windowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const authMax = Number(process.env.AUTH_RATE_LIMIT_MAX) || 10;
const walletMax = Number(process.env.WALLET_RATE_LIMIT_MAX) || 8;
const contentWindowMs = Number(process.env.CONTENT_ACCESS_RATE_LIMIT_WINDOW_MS) || 60_000;
const contentMax = Number(process.env.CONTENT_ACCESS_RATE_LIMIT_MAX) || 60;
const authRateLimit = createRateLimiter({ windowMs, max: authMax });
const walletRateLimit = createRateLimiter({ windowMs, max: walletMax });
const contentAccessRateLimit = createRateLimiter({
  windowMs: contentWindowMs,
  max: contentMax,
  keyGenerator: (req) => `${req.user?.userId || 'anonymous'}:${req.ip || req.socket?.remoteAddress || 'unknown'}`,
});

module.exports = { createRateLimiter, authRateLimit, walletRateLimit, contentAccessRateLimit };
