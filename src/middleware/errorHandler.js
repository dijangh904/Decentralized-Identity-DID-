function sendError(res, statusCode, message, code = 'REQUEST_FAILED', details = undefined) {
  return res.status(statusCode).json({
    success: false,
    message,
    error: message,
    code,
    details,
  });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const message =
    statusCode >= 500
      ? 'Something went wrong. Please try again later.'
      : err.message || 'Request failed';

  console.error(err);

  return sendError(res, statusCode, message, err.code || 'INTERNAL_SERVER_ERROR');
}

module.exports = {
  sendError,
  asyncHandler,
  errorHandler,
};
