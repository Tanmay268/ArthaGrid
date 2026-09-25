<<<<<<< HEAD
const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
    // Always log the full error internally, regardless of what we send back
    logger.error({ err, method: req.method, path: req.path }, err.message);

    // Known operational error
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            success: false,
            error: {
                message: err.message,
                details: err.details,
            },
        });
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const details = Object.values(err.errors).map((e) => ({
            field: e.path,
            message: e.message,
        }));

        return res.status(422).json({
            success: false,
            error: {
                message: 'Validation failed',
                errors: details,
            },
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            error: {
                message: 'Invalid Token',
            },
        });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: {
                message: 'Token expired',
            },
        });
    }

    // Mongoose duplicate key (like if duplicate email)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(409).json({
            success: false,
            error: {
                message: `${field} already exists`,
            },
        });
    }

    // Unknown/unexpected error — never leak internals (stack traces, file
    // paths, library details) to the client, especially in production.
    const isProd = process.env.NODE_ENV === 'production';
    res.status(err.statusCode || 500).json({
        success: false,
        error: {
            message: isProd ? 'Something went wrong' : err.message,
            ...(isProd ? {} : { stack: err.stack }),
        },
    });
=======
const ApiError = require('../utils/ApiError');

const errorHandler = (err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';

  // Internal logging
  const level = (!err.statusCode || err.statusCode >= 500) ? 'error' : 'warn';
  console[level](`[${req.method}] ${req.path} →`, err.message);
  if (isDev && level === 'error') console.error(err.stack);

  // Known operational error
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: { message: err.message, details: err.details ?? [] },
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map(e => ({
      field: e.path, message: e.message,
    }));
    return res.status(422).json({
      success: false,
      error: { message: 'Validation failed', details },
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    return res.status(409).json({
      success: false,
      error: { message: `${field} '${value}' is already taken` },
    });
  }

  // Mongoose invalid ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    return res.status(400).json({
      success: false,
      error: { message: `Invalid ID format: '${err.value}'` },
    });
  }

  // MongoDB connection error
  if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError') {
    return res.status(503).json({
      success: false,
      error: { message: 'Database unavailable. Please try again shortly.' },
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid token. Please log in again.' },
    });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: { message: 'Token expired. Please log in again.' },
    });
  }

  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid JSON in request body' },
    });
  }

  // Payload too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: { message: 'Request body too large' },
    });
  }

  // Unknown error — never leak internals in production
  res.status(500).json({
    success: false,
    error: { message: isDev ? err.message : 'An unexpected error occurred' },
  });
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
};

module.exports = errorHandler;
