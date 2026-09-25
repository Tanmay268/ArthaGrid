const mongoose = require('mongoose');
<<<<<<< HEAD
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

=======

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log(`✓ MongoDB connected: ${conn.connection.host}`);
};

>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
module.exports = connectDB;
