const ApiError = require('../utils/ApiError');

const errorHandler = (err, req, res, next) => {
    //Log full error internally
    console.log(`$[{req.method}] ${req.path} ->`, err.message);

    //known operational error
    if(err.isOperational){
        return res.status(err.statusCode).json({
            success: false,
            error: {
                message: err.message,
                details: err.details,
            },

        });
    }

    //Mongoose validation error
    if(err.name === 'ValidationError'){
        const details = Object.values(err.errors).map(e => ({
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

    //JWT errors
    if(err.name === 'JsonWebTokenError'){
        return res.status(401).json({
            success: false,
            error: {
                message: 'Invalid Token',
            },
        });
    }
    if(err.name === 'TokenExpiredError'){
        return res.status(401).json({
            success: false,
            error: {
                message: 'Token expired',
            },
        });
    }

    //Mongoose duplicate key (like if duplicate email)
    if(err.code === 11000){
        const field = Object.keys(err.keyValue)[0];
        return res.status(409).json({
            success: false,
            error: {
                message: `${field} already exists`,
            },
        });
    }

    //Unknown error
    // res.status(500).json({
    //     success: false,
    //     error: {
    //         message: 'Something went wrong',
    //     },
    // });
    res.status(err.statusCode || 500).json({
  success: false,
  error: {
    message: err.message,
    stack: err.stack
  }
});
};

module.exports = errorHandler;