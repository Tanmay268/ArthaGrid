require('dotenv').config();
<<<<<<< HEAD
require('./src/config/env'); // validate required env vars, fail fast if misconfigured

const app = require('./src/app');
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const { connectPostgres, closePostgres } = require('./src/config/postgres');
const logger = require('./src/config/logger');

const PORT = process.env.PORT || 5000;

let server;

const start = async () => {
    await connectDB();
    await connectPostgres(); // optional — analytics falls back to MongoDB if this doesn't connect (see decisions.md #17)
    server = app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
};

const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);

    if (!server) return process.exit(0);

    server.close(async () => {
        await mongoose.connection.close();
        await closePostgres();
        logger.info('Shutdown complete.');
        process.exit(0);
    });

    // Force-exit if connections don't close within 10s
    setTimeout(() => {
        logger.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 10000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

=======
const app       = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;
const baseUrl = process.env.APP_BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

const start = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`\nServer running on ${baseUrl}`);
      console.log(`Swagger docs:  ${baseUrl}/api/docs`);
      console.log(`Health check: ${baseUrl}/health\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
start();
