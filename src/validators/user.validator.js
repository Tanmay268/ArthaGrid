const Joi = require('joi');
const { ROLES } = require('../models/User');
const { passwordComplexity } = require('./shared');

const selfUpdateSchema = Joi.object({
    name: Joi.string().min(2).max(100),
    password: passwordComplexity,
    weeklyReport: Joi.boolean(),
}).min(1);

const adminUpdateSchema = Joi.object({
    name: Joi.string().min(2).max(100),
    role: Joi.string().valid(...Object.values(ROLES)),
    isActive: Joi.boolean(),
}).min(1);

const listUsersQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    role: Joi.string().valid(...Object.values(ROLES)),
    isActive: Joi.boolean(),
});

module.exports = { selfUpdateSchema, adminUpdateSchema, listUsersQuerySchema };
