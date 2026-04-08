/**
 * Integration test setup — connects to a real PostgreSQL database,
 * runs migrations, and provides helpers for test lifecycle.
 *
 * Requires: DATABASE_URL pointing to a test database
 * (e.g. via docker-compose.test.yml on port 5433)
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const TEST_DATABASE_URL = process.env.DATABASE_URL
    || 'postgresql://foodplanner_test:test_secret@localhost:5433/foodplanner_test';

let pool;

/**
 * Create a fresh connection pool for tests.
 */
function getPool() {
    if (!pool) {
        pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 5 });
    }
    return pool;
}

/**
 * Run all SQL migrations from backend/db/migrations/ in order.
 * Handles idempotent migrations (types/tables that already exist).
 */
async function runMigrations() {
    const migrationsDir = path.join(__dirname, '..', '..', 'db', 'migrations');
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    const client = await getPool().connect();
    try {
        for (const file of files) {
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            try {
                await client.query(sql);
            } catch (err) {
                // Ignore "already exists" errors (idempotent migrations)
                if (err.code === '42P07' || err.code === '42710') continue;
                throw err;
            }
        }
    } finally {
        client.release();
    }
}

/**
 * Truncate all application tables so each test suite starts clean.
 * Uses TRUNCATE ... CASCADE to handle foreign key constraints.
 */
async function resetDatabase() {
    const client = await getPool().connect();
    try {
        // Get all user-created tables (exclude system tables)
        const { rows } = await client.query(`
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public' AND tablename != 'schema_migrations'
        `);
        if (rows.length > 0) {
            const tables = rows.map(r => `"${r.tablename}"`).join(', ');
            await client.query(`TRUNCATE ${tables} CASCADE`);
        }
    } finally {
        client.release();
    }
}

/**
 * Start the Express app on a random port and return { baseUrl, server }.
 * Requires JWT_SECRET to be set before importing server.
 */
async function startApp() {
    // Set required env vars for the app
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-integration';
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';

    const { app } = require('../../server');

    return new Promise((resolve) => {
        const server = app.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({ baseUrl: `http://127.0.0.1:${port}`, server });
        });
    });
}

/**
 * Clean shutdown — close pool and server.
 */
async function teardown(server) {
    if (server) {
        await new Promise((resolve) => server.close(resolve));
    }
    if (pool) {
        await pool.end();
        pool = null;
    }
}

/**
 * Helper: make an HTTP request to the test server.
 */
async function request(baseUrl, method, path, { body, headers = {}, cookies } = {}) {
    const url = `${baseUrl}${path}`;
    const opts = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        redirect: 'manual'
    };
    if (body) {
        opts.body = JSON.stringify(body);
    }
    if (cookies) {
        opts.headers['Cookie'] = cookies;
    }

    const res = await fetch(url, opts);
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : await res.text();

    // Extract Set-Cookie header for refresh token tests
    const setCookie = res.headers.get('set-cookie') || '';

    return { status: res.status, data, setCookie, headers: res.headers };
}

module.exports = {
    getPool,
    runMigrations,
    resetDatabase,
    startApp,
    teardown,
    request
};
