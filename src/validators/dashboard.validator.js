const Joi = require('joi');

const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso(),
  endDate:   Joi.date().iso().min(Joi.ref('startDate'))
<<<<<<< HEAD
    .messages({ 'date.min': 'endDate must be after startDate' }),
});

const summarySchema = dateRangeSchema;

const categorySchema = dateRangeSchema.keys({
  type: Joi.string().valid('income', 'expense'),
});

const trendsSchema = dateRangeSchema.keys({
=======
               .messages({ 'date.min': 'endDate must be after startDate' }),
});

const summarySchema   = dateRangeSchema;

const categorySchema  = dateRangeSchema.keys({
  type: Joi.string().valid('income', 'expense'),
});

const trendsSchema    = dateRangeSchema.keys({
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
  period: Joi.string().valid('monthly', 'weekly').default('monthly'),
  year:   Joi.number().integer().min(2000).max(new Date().getFullYear()),
});

<<<<<<< HEAD
const recentSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(20).default(5),
});

module.exports = { summarySchema, categorySchema, trendsSchema, recentSchema };
=======
const recentSchema    = Joi.object({
  limit: Joi.number().integer().min(1).max(20).default(5),
});

const auditQuerySchema = Joi.object({
  action:      Joi.string(),
  performedBy: Joi.string(),
  startDate:   Joi.date().iso(),
  endDate:     Joi.date().iso(),
  page:        Joi.number().integer().min(1).default(1),
  limit:       Joi.number().integer().min(1).max(100).default(20),
});

module.exports = { summarySchema, categorySchema, trendsSchema, recentSchema, auditQuerySchema };
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
