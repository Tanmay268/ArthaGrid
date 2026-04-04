const ApiError = require('../utils/ApiError');

/**
 * Joi validation middleware factory.
 * @param {Object} schema - Joi schema
 * @param {'body'|'query'|'params'} target - which part of req to validate
 */
const validate = (schema, target = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(d => ({
        field:   d.path.join('.'),
        message: d.message.replace(/['"]/g, ''),
      }));
      throw ApiError.badRequest('Validation failed', details);
    }

    req[target] = value;
    next();
  };
};

module.exports = validate;
