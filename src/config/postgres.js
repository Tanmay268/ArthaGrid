const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const logger = require('./logger');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

let pool = null;

// Postgres is OPTIONAL, unlike MongoDB. It only ever holds derived,
// rebuildable analytics rollups (see docs/decisions.md #17) — every feature
// works without it, just by computing live from MongoDB instead. This lets
// ArthaGrid run on just a MongoDB Atlas free tier if that's all you've set
// up, and add Neon later without any code change.
const isConfigured = () => Boolean(process.env.POSTGRES_URL);

const connectPostgres = async (retriesLeft = MAX_RETRIES) => {
    if (!isConfigured()) {
        logger.info('POSTGRES_URL not set — analytics rollups disabled; endpoints will compute live from MongoDB.');
        return null;
    }

    try {
        const candidatePool = new Pool({
            connectionString: process.env.POSTGRES_URL,
            // Most free managed Postgres hosts (Neon, Render Postgres, Supabase)
            // require SSL but present a certificate chain `pg` won't validate
            // by default without extra CA setup — this matches how those
            // providers document connecting from a generic Node client.
            ssl: { rejectUnauthorized: false },
        });

        await candidatePool.query('SELECT 1'); // fail fast if the connection string is bad

        const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
        await candidatePool.query(schemaSql); // idempotent (CREATE TABLE IF NOT EXISTS) — safe on every boot

        pool = candidatePool;
        logger.info('Postgres connected (analytics rollup store)');
        return pool;
    } catch (err) {
        if (retriesLeft > 0) {
            logger.warn(
                `Postgres connection failed (${err.message}). Retrying in ${RETRY_DELAY_MS / 1000}s... (${retriesLeft} attempt(s) left)`
            );
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            return connectPostgres(retriesLeft - 1);
        }

        // Deliberately does NOT throw — unlike MongoDB, a broken Postgres
        // connection should degrade to "compute analytics live from Mongo,"
        // not take the whole API down.
        logger.error('Postgres connection failed after all retries — continuing without it. Analytics will compute live from MongoDB.');
        pool = null;
        return null;
    }
};

const getPool = () => pool;

const closePostgres = async () => {
    if (pool) await pool.end();
    pool = null;
};

module.exports = { connectPostgres, getPool, closePostgres, isConfigured };
