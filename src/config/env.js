const Joi = require('joi');

// Validates process.env once, at boot, so the app fails fast with a clear
// message instead of crashing deep inside a request (or connecting to an
// undefined database) when a required variable is missing or malformed.
const envSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().integer().default(5000),
    MONGO_URI: Joi.string().uri({ scheme: ['mongodb', 'mongodb+srv'] }).required(),
    JWT_SECRET: Joi.string().min(32).required()
        .messages({ 'string.min': 'JWT_SECRET must be at least 32 characters long' }),
    ACCESS_TOKEN_EXPIRES_IN: Joi.string().default('15m'),
    REFRESH_TOKEN_EXPIRES_IN_DAYS: Joi.number().integer().min(1).default(7),
    LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
}).unknown(true);

const { error, value: validatedEnv } = envSchema.validate(process.env);

if (error) {
    throw new Error(`Invalid environment configuration: ${error.message}`);
}

// Write back defaults so every other module reading process.env directly
// (db.js, auth.service.js, etc.) sees the same validated/defaulted values.
Object.assign(process.env, {
    PORT: String(validatedEnv.PORT),
    ACCESS_TOKEN_EXPIRES_IN: validatedEnv.ACCESS_TOKEN_EXPIRES_IN,
    REFRESH_TOKEN_EXPIRES_IN_DAYS: String(validatedEnv.REFRESH_TOKEN_EXPIRES_IN_DAYS),
    LOG_LEVEL: validatedEnv.LOG_LEVEL,
});

module.exports = validatedEnv;
