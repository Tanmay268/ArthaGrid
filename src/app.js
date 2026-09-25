<<<<<<< HEAD
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
=======
require('express-async-errors');

const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const morgan         = require('morgan');
const mongoSanitize  = require('express-mongo-sanitize');
const hpp            = require('hpp');
const swaggerUi      = require('swagger-ui-express');
const { randomUUID } = require('crypto');

const swaggerSpec    = require('./config/swagger');
const errorHandler   = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const appBaseUrl = process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || '';
const appOrigin = appBaseUrl ? new URL(appBaseUrl).origin : null;

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(cors({
  origin(origin, callback) {
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    if (!origin || origin === appOrigin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Parsing ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Sanitization ──────────────────────────────────────────────────────────────
app.use(mongoSanitize());   // prevent NoSQL injection
app.use(hpp());             // prevent HTTP parameter pollution

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Request ID ────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);

// ── Swagger docs ──────────────────────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Finance API Docs',
  swaggerOptions: { persistAuthorization: true },
}));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date(),
    env:       process.env.NODE_ENV,
    version:   '1.0.0',
  });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ArthaGrid API is running',
    docs: '/api/docs',
    health: '/health',
    apiBase: '/api/v1',
  });
});

app.use('/api/v1', require('./routes/v1'));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { message: `Route ${req.method} ${req.path} not found` },
  });
});

// ── Global error handler (must be last) ───────────────────────────────────────
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
app.use(errorHandler);

module.exports = app;
