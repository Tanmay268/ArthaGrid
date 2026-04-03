const Joi = require('joi');

const registerSchema = Joi.object({
    name: Joi.string().required().min(2).max(100),
    email: Joi.string().required().email(),
    password: Joi.string().required().min(6),
    role: Joi.string().valid('viewer', 'analyst', 'admin').default('viewer'),
});

const loginSchema = Joi.object({
    email: Joi.string().required().email(),
    password: Joi.string().required(),
});

module.exports = { registerSchema, loginSchema };