const Joi = require('joi');

const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().min(Joi.ref('startDate'))
    .messages({ 'date.min': 'endDate must be after startDate' }),
});

const metricsSchema = dateRangeSchema;

const forecastSchema = Joi.object({
  months: Joi.number().integer().min(1).max(12).default(3),
  metric: Joi.string().valid('income', 'expenses', 'net').default('expenses'),
});

module.exports = { metricsSchema, forecastSchema };
