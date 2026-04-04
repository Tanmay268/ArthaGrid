require('dotenv').config();
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

start();
