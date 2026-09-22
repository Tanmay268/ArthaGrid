const pino = require('pino');

const isProd = process.env.NODE_ENV === 'production';

const logger = pino(
    isProd
        ? { level: process.env.LOG_LEVEL || 'info' }
        : {
              level: process.env.LOG_LEVEL || 'debug',
              transport: {
                  target: 'pino-pretty',
                  options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
              },
          }
);

module.exports = logger;
