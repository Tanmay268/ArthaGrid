const Joi = require('joi');
const { ROLES } = require('../models/User');
const { passwordComplexity } = require('./shared');

const registerSchema = Joi.object({
    name: Joi.string().required().min(2).max(100),
    email: Joi.string().required().email(),
    password: passwordComplexity.required(),
    role: Joi.string().valid(...Object.values(ROLES)).default(ROLES.VIEWER),
});

const loginSchema = Joi.object({
    email: Joi.string().required().email(),
    password: Joi.string().required(),
});

// Optional here, not required — a browser client relies on the httpOnly
// refresh-token cookie instead of sending it in the body (see
// extractRefreshToken middleware, which enforces that *some* source
// provided a token before either route handler ever runs).
const refreshSchema = Joi.object({
    refreshToken: Joi.string(),
});

const logoutSchema = Joi.object({
    refreshToken: Joi.string(),
});

module.exports = { registerSchema, loginSchema, refreshSchema, logoutSchema };
