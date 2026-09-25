const mongoose = require('mongoose');
const logger = require('./logger');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

const connectDB = async (retriesLeft = MAX_RETRIES) => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        logger.info(`MongoDB connected: ${conn.connection.host}`);
    } catch (err) {
        if (retriesLeft > 0) {
            logger.warn(
                `MongoDB connection failed (${err.message}). Retrying in ${RETRY_DELAY_MS / 1000}s... (${retriesLeft} attempt(s) left)`
            );
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            return connectDB(retriesLeft - 1);
        }
        logger.error('MongoDB connection failed after all retries. Exiting.');
        throw err;
    }
};

mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB connection error'));

module.exports = connectDB;
