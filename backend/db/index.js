const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    logger.error('Unexpected error on idle client', { error: err.message, stack: err.stack, component: 'database' });
    process.exit(-1);
});

// Query helper with automatic error handling
const query = async (text, params) => {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV === 'development') {
            logger.debug('Query executed', {
                text: text.substring(0, 80).replace(/\s+/g, ' '),
                duration: `${duration}ms`,
                rows: result.rowCount,
                component: 'database'
            });
        }
        return result;
    } catch (error) {
        logger.error('Database query error', { error: error.message, query: text.substring(0, 80), component: 'database' });
        throw error;
    }
};

// Transaction helper
const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Get a client for manual transaction management
const getClient = () => pool.connect();

// Check database connection
const checkConnection = async () => {
    try {
        const result = await pool.query('SELECT NOW()');
        logger.info('Database connected', { timestamp: result.rows[0].now, component: 'database' });
        return true;
    } catch (error) {
        logger.error('Database connection failed', { error: error.message, component: 'database' });
        return false;
    }
};

// Run database migrations
const runMigrations = async () => {
    const migrationsDir = path.join(__dirname, 'migrations');

    if (!fs.existsSync(migrationsDir)) {
        logger.info('No migrations directory found', { component: 'database' });
        return;
    }

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        try {
            await pool.query(sql);
            logger.info(`Migration applied: ${file}`, { component: 'database' });
        } catch (error) {
            // Ignore "already exists" errors for idempotent migrations
            if (error.code === '42P07' || error.code === '42710') {
                logger.debug(`Migration already applied: ${file}`, { component: 'database' });
            } else {
                throw error;
            }
        }
    }

    logger.info('All migrations completed', { component: 'database' });
};

// Graceful shutdown
const close = async () => {
    await pool.end();
    logger.info('Database pool closed', { component: 'database' });
};

module.exports = {
    pool,
    query,
    transaction,
    getClient,
    checkConnection,
    runMigrations,
    close
};
