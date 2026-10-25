// Lightweight error type carrying an HTTP status code, so controllers
// can `throw new ApiError(404, 'Content not found')` and the central
// error handler will respond correctly without leaking internals.
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isApiError = true;
  }
}

module.exports = ApiError;
