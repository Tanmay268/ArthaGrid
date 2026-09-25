const Joi = require('joi');

const askSchema = Joi.object({
  question: Joi.string().trim().min(3).max(300).required(),
});

module.exports = { askSchema };
