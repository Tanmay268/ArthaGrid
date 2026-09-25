const Joi = require('joi');
const { TRANSACTION_TYPES, CATEGORIES } = require('../models/Transaction');

const createTransactionSchema = Joi.object({
<<<<<<< HEAD
  amount: Joi.number().positive().precision(2).required()
            .messages({ 'number.positive': 'Amount must be a positive number' }),
  type: Joi.string().valid(...TRANSACTION_TYPES).required(),
  category: Joi.string().valid(...CATEGORIES).required(),
  merchant: Joi.string().trim().max(100).allow('', null).default(null),
  date: Joi.date().iso().max('now').default(() => new Date())
            .messages({ 'date.max': 'Date cannot be in the future' }),
=======
  amount:      Joi.number().positive().precision(2).required()
                 .messages({ 'number.positive': 'Amount must be a positive number' }),
  type:        Joi.string().valid(...TRANSACTION_TYPES).required(),
  category:    Joi.string().valid(...CATEGORIES).required(),
  date:        Joi.date().iso().max('now').default(() => new Date())
                 .messages({ 'date.max': 'Date cannot be in the future' }),
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
  description: Joi.string().max(500).allow('').default(''),
});

const updateTransactionSchema = Joi.object({
<<<<<<< HEAD
  amount: Joi.number().positive().precision(2),
  type: Joi.string().valid(...TRANSACTION_TYPES),
  category: Joi.string().valid(...CATEGORIES),
  merchant: Joi.string().trim().max(100).allow('', null),
  date: Joi.date().iso().max('now'),
=======
  amount:      Joi.number().positive().precision(2),
  type:        Joi.string().valid(...TRANSACTION_TYPES),
  category:    Joi.string().valid(...CATEGORIES),
  date:        Joi.date().iso().max('now'),
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
  description: Joi.string().max(500).allow(''),
}).min(1).messages({ 'object.min': 'At least one field is required for update' });

const queryTransactionSchema = Joi.object({
  type:       Joi.string().valid(...TRANSACTION_TYPES),
  category:   Joi.string().valid(...CATEGORIES),
  startDate:  Joi.date().iso(),
  endDate:    Joi.date().iso().min(Joi.ref('startDate'))
                .messages({ 'date.min': 'endDate must be after startDate' }),
  minAmount:  Joi.number().positive(),
<<<<<<< HEAD
  maxAmount:  Joi.number().positive().min(Joi.ref('minAmount'))
                .messages({ 'number.min': 'maxAmount must be greater than minAmount' }),
=======
  maxAmount:  Joi.number().positive(),
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
  page:       Joi.number().integer().min(1).default(1),
  limit:      Joi.number().integer().min(1).max(100).default(20),
  sortBy:     Joi.string().valid('date', 'amount', 'createdAt').default('date'),
  sortOrder:  Joi.string().valid('asc', 'desc').default('desc'),
});

<<<<<<< HEAD
// At least one of description/merchant must be a non-empty string.
const suggestCategorySchema = Joi.object({
  description: Joi.string().trim().min(1).max(200),
  merchant: Joi.string().trim().min(1).max(100),
  type: Joi.string().valid(...TRANSACTION_TYPES),
}).or('description', 'merchant');

module.exports = { createTransactionSchema, updateTransactionSchema, queryTransactionSchema, suggestCategorySchema };
=======
module.exports = { createTransactionSchema, updateTransactionSchema, queryTransactionSchema };
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
