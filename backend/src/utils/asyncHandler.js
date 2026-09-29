// Wraps an async Express route handler so rejected promises are passed
// to next(err) instead of crashing the process / hanging the request.
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
