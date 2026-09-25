// Runs before the test framework and any test module is loaded (jest "setupFiles").
// Provides safe, fake values so nothing in the app accidentally touches
// real secrets or a real database while tests run.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_only_jwt_secret_at_least_32_characters_long';
process.env.ACCESS_TOKEN_EXPIRES_IN = '15m';
process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS = '7';
process.env.LOG_LEVEL = 'silent';
process.env.CRON_SECRET = 'test_only_cron_secret';
// POSTGRES_URL is deliberately left unset — tests run against MongoDB only
// (see src/config/postgres.js: Postgres is optional, analytics falls back
// to computing live from MongoDB when it isn't configured).
