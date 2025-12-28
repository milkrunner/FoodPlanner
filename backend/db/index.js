const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

// Query helper with automatic error handling
const query = async (text, params) => {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV === 'development') {
            console.log('Query executed', {
                text: text.substring(0, 80).replace(/\s+/g, ' '),
                duration: `${duration}ms`,
                rows: result.rowCount
            });
        }
        return result;
    } catch (error) {
        console.error('Database query error:', error.message);
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
        console.log('Database connected at:', result.rows[0].now);
        return true;
    } catch (error) {
        console.error('Database connection failed:', error.message);
        return false;
    }
};

// Graceful shutdown
const close = async () => {
    await pool.end();
    console.log('Database pool closed');
};

module.exports = {
    pool,
    query,
    transaction,
    getClient,
    checkConnection,
    close
};
