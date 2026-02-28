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

// Run database migrations with tracking
const runMigrations = async () => {
    const migrationsDir = path.join(__dirname, 'migrations');

    if (!fs.existsSync(migrationsDir)) {
        logger.info('No migrations directory found', { component: 'database' });
        return;
    }

    // Create tracking table if it doesn't exist
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename VARCHAR(255) PRIMARY KEY,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Get already-applied migrations
    const { rows: applied } = await pool.query('SELECT filename FROM schema_migrations');
    const appliedSet = new Set(applied.map(r => r.filename));

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    let newCount = 0;
    for (const file of files) {
        if (appliedSet.has(file)) continue;

        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        try {
            await pool.query(sql);
            await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
            logger.info(`Migration applied: ${file}`, { component: 'database' });
            newCount++;
        } catch (error) {
            // Ignore "already exists" errors for idempotent migrations (legacy compat)
            if (error.code === '42P07' || error.code === '42710') {
                await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
                logger.debug(`Migration already applied: ${file}`, { component: 'database' });
            } else {
                throw error;
            }
        }
    }

    logger.info(`Migrations completed (${newCount} new, ${files.length} total)`, { component: 'database' });
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
