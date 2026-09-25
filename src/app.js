require('express-async-errors'); // Must be first — patches async error forwarding
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const errorHandler = require('./middleware/errorHandler');
const verifyMetricsToken = require('./middleware/verifyMetricsToken');
const { register, metricsMiddleware } = require('./config/metrics');
const { shouldSkipRateLimit } = require('./config/rateLimit');

const app = express();

// Behind a platform proxy (Render, Vercel, etc.) the socket address is the
// proxy's, not the client's. Without this, express-rate-limit keys every
// request to the same IP — one noisy user would rate-limit everyone — and
// secure cookies can misbehave. `1` trusts exactly one hop, not arbitrary
// X-Forwarded-For values a client could forge.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

// Security + parsing middleware
app.use(helmet());
// `credentials: true` is required for the httpOnly refresh-token cookie
// (decisions.md #21) to be sent/received across origins — the frontend and
// API are deployed on different domains. With credentials enabled, the
// origin can't be a wildcard: CORS_ORIGIN pins it to the real frontend URL
// in production; left unset (local development), the request's own Origin
// header is reflected back, which keeps `npm run dev` working without
// configuration while still being meaningfully scoped in production.
app.use(cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(mongoSanitize()); // strips $ / . operators from user input to block NoSQL injection
app.use(morgan('dev'));
app.use(metricsMiddleware);

// Baseline rate limit for every API route — auth routes layer a stricter
// limiter of their own on top of this (see routes/v1/auth.routes.js)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit, // real rate limiting stays on in dev/production
    message: { success: false, error: { message: 'Too many requests. Please slow down.' } },
});
app.use('/api', globalLimiter);

// Friendly landing response for anyone who opens the API's base URL directly
app.get('/', (req, res) =>
  res.json({
    name: 'ArthaGrid API',
    docs: '/api-docs/',
    health: '/health',
    version: 'v1',
    base: '/api/v1',
  })
);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Prometheus scrape endpoint — token-protected, fails closed (see
// middleware/verifyMetricsToken.js and docs/observability.md)
app.get('/metrics', verifyMetricsToken, async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
});

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
