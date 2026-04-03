require('express-async-errors'); // Must be first — patches async error forwarding
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security + parsing middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// API routes
app.use('/api/v1', require('./routes/v1'));

// 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: { message: `Route ${req.method} ${req.path} not found` } });
});

// Global error handler — must be last
app.use(errorHandler);

module.exports = app;