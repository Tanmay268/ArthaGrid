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

const refreshSchema = Joi.object({
    refreshToken: Joi.string().required(),
});

const logoutSchema = Joi.object({
    refreshToken: Joi.string().required(),
});

module.exports = { registerSchema, loginSchema, refreshSchema, logoutSchema };
