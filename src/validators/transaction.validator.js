const Joi = require('joi');
const { TRANSACTION_TYPES, CATEGORIES } = require('../models/Transaction');

const createTransactionSchema = Joi.object({
  amount: Joi.number().positive().precision(2).required()
            .messages({ 'number.positive': 'Amount must be a positive number' }),
  type: Joi.string().valid(...TRANSACTION_TYPES).required(),
  category: Joi.string().valid(...CATEGORIES).required(),
  merchant: Joi.string().trim().max(100).allow('', null).default(null),
  date: Joi.date().iso().max('now').default(() => new Date())
            .messages({ 'date.max': 'Date cannot be in the future' }),
  description: Joi.string().max(500).allow('').default(''),
});

const updateTransactionSchema = Joi.object({
  amount: Joi.number().positive().precision(2),
  type: Joi.string().valid(...TRANSACTION_TYPES),
  category: Joi.string().valid(...CATEGORIES),
  merchant: Joi.string().trim().max(100).allow('', null),
  date: Joi.date().iso().max('now'),
  description: Joi.string().max(500).allow(''),
}).min(1).messages({ 'object.min': 'At least one field is required for update' });

const queryTransactionSchema = Joi.object({
  type:       Joi.string().valid(...TRANSACTION_TYPES),
  category:   Joi.string().valid(...CATEGORIES),
  startDate:  Joi.date().iso(),
  endDate:    Joi.date().iso().min(Joi.ref('startDate'))
                .messages({ 'date.min': 'endDate must be after startDate' }),
  minAmount:  Joi.number().positive(),
  maxAmount:  Joi.number().positive().min(Joi.ref('minAmount'))
                .messages({ 'number.min': 'maxAmount must be greater than minAmount' }),
  page:       Joi.number().integer().min(1).default(1),
  limit:      Joi.number().integer().min(1).max(100).default(20),
  sortBy:     Joi.string().valid('date', 'amount', 'createdAt').default('date'),
  sortOrder:  Joi.string().valid('asc', 'desc').default('desc'),
});

module.exports = { createTransactionSchema, updateTransactionSchema, queryTransactionSchema };