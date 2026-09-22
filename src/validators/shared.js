const Joi = require('joi');

// Shared password rule so registration and profile updates can never drift
// out of sync with each other.
const passwordComplexity = Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
    .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base':
            'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    });

module.exports = { passwordComplexity };
