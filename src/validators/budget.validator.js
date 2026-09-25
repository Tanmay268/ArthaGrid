const Joi = require('joi');
const { EXPENSE_CATEGORIES } = require('../models/Transaction');

const createBudgetSchema = Joi.object({
  category: Joi.string().valid(...EXPENSE_CATEGORIES).required(),
  monthlyLimit: Joi.number().positive().precision(2).required(),
  isActive: Joi.boolean().default(true),
});

const updateBudgetSchema = Joi.object({
  monthlyLimit: Joi.number().positive().precision(2),
  isActive: Joi.boolean(),
}).min(1).messages({ 'object.min': 'At least one field is required for update' });

module.exports = { createBudgetSchema, updateBudgetSchema };
