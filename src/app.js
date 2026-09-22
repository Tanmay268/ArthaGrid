require('express-async-errors'); // Must be first — patches async error forwarding
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security + parsing middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(mongoSanitize()); // strips $ / . operators from user input to block NoSQL injection
app.use(morgan('dev'));

// Baseline rate limit for every API route — auth routes layer a stricter
// limiter of their own on top of this (see routes/v1/auth.routes.js)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test', // real rate limiting stays on in dev/production
    message: { success: false, error: { message: 'Too many requests. Please slow down.' } },
});
app.use('/api', globalLimiter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// API documentation (OpenAPI spec rendered with Swagger UI)
const openapiDocument = YAML.load(path.join(__dirname, '..', 'docs', 'openapi.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

// API routes
app.use('/api/v1', require('./routes/v1'));

// 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: { message: `Route ${req.method} ${req.path} not found` } });
});

// Global error handler — must be last
app.use(errorHandler);

module.exports = app;
