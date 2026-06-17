/**
 * Global Error Handler Middleware
 * Catches all errors thrown in routes/controllers and returns
 * structured JSON error responses with appropriate HTTP status codes.
 */

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Default to 500 Internal Server Error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // ── Mongoose Validation Error ────────────────────────────
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors).map((e) => e.message);
    message = `Validation failed: ${errors.join(', ')}`;
  }

  // ── Mongoose Duplicate Key Error ─────────────────────────
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value for field: ${field}`;
  }

  // ── Mongoose Cast Error (invalid ObjectId) ───────────────
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}: ${err.value}`;
  }

  // ── JWT Errors ───────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
  }

  // ── Log error in development ─────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    console.error('❌ Error:', {
      statusCode,
      message,
      stack: err.stack,
      path: req.originalUrl,
      method: req.method,
    });
  }

  // ── Send structured error response ───────────────────────
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
}

module.exports = errorHandler;
