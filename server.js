require('dotenv').config();
require('./src/config/env'); // validate required env vars, fail fast if misconfigured

const app = require('./src/app');
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const logger = require('./src/config/logger');

const PORT = process.env.PORT || 5000;

let server;

const start = async () => {
    await connectDB();
    server = app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
};

const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);

    if (!server) return process.exit(0);

    server.close(async () => {
        await mongoose.connection.close();
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

start();
