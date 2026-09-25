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

    // Body-parser failures are the client's mistake, not ours: a malformed
    // JSON body, or one over the size limit. Without this they would fall
    // through to the "unexpected error" branch below, which in production
    // says "Something went wrong" for what is really a 400/413.
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            error: { message: 'Invalid JSON in request body' },
        });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            error: { message: 'Request body too large' },
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
};

module.exports = errorHandler;
