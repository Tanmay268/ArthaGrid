const Joi = require('joi');
<<<<<<< HEAD
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
=======

const registerSchema = Joi.object({
  name:     Joi.string().min(2).max(100).required(),
  email:    Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role:     Joi.forbidden(),
});

const loginSchema = Joi.object({
  email:    Joi.string().email().required(),
  password: Joi.string().required(),
});

module.exports = { registerSchema, loginSchema };
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
