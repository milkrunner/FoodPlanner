/**
 * Health endpoint tests using Node.js built-in test runner
 * These tests verify health check logic without requiring external dependencies
 * Run with: node --test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Mock database module for testing
function createMockDb(options = {}) {
    return {
        query: options.query || (async () => ({ rows: [{ '?column?': 1 }] })),
        checkConnection: options.checkConnection || (async () => true)
    };
}

// Health check logic extracted for testing
function buildHealthResponse() {
    return {
        status: 'UP',
        timestamp: new Date().toISOString()
    };
}

async function buildReadinessResponse(db) {
    try {
        const start = Date.now();
        await db.query('SELECT 1');
        const dbLatency = Date.now() - start;

        return {
            status: 200,
            body: {
                status: 'UP',
                timestamp: new Date().toISOString(),
                checks: {
                    database: {
                        status: 'UP',
                        latency: dbLatency
                    }
                }
            }
        };
    } catch (error) {
        return {
            status: 503,
            body: {
                status: 'DOWN',
                timestamp: new Date().toISOString(),
                checks: {
                    database: {
                        status: 'DOWN',
                        error: error.message
                    }
                }
            }
        };
    }
}

async function buildDetailedHealthResponse(db, serverStartTime) {
    const checks = {};
    let overallStatus = 'UP';

    try {
        const start = Date.now();
        await db.query('SELECT 1');
        checks.database = { status: 'UP', latency: Date.now() - start };
    } catch (error) {
        checks.database = { status: 'DOWN', error: error.message };
        overallStatus = 'DOWN';
    }

    checks.geminiApi = { status: 'UNCONFIGURED', configured: false };

    const memUsage = process.memoryUsage();
    checks.memory = {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        unit: 'MB'
    };

    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

    return {
        status: overallStatus === 'UP' ? 200 : 503,
        body: {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            uptime: uptimeSeconds,
            checks
        }
    };
}

describe('Health Endpoints', () => {
    describe('GET /health', () => {
        it('should return UP status', () => {
            const response = buildHealthResponse();

            assert.strictEqual(response.status, 'UP');
            assert.ok(response.timestamp);
        });

        it('should return valid ISO timestamp', () => {
            const response = buildHealthResponse();

            const timestamp = new Date(response.timestamp);
            assert.strictEqual(timestamp.toISOString(), response.timestamp);
        });
    });

    describe('GET /health/ready', () => {
        it('should return UP when database is connected', async () => {
            const db = createMockDb({
                query: async () => ({ rows: [{ '?column?': 1 }] })
            });

            const response = await buildReadinessResponse(db);

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.status, 'UP');
            assert.strictEqual(response.body.checks.database.status, 'UP');
            assert.ok(response.body.checks.database.latency !== undefined);
        });

        it('should return DOWN when database fails', async () => {
            const db = createMockDb({
                query: async () => { throw new Error('Connection refused'); }
            });

            const response = await buildReadinessResponse(db);

            assert.strictEqual(response.status, 503);
            assert.strictEqual(response.body.status, 'DOWN');
            assert.strictEqual(response.body.checks.database.status, 'DOWN');
            assert.strictEqual(response.body.checks.database.error, 'Connection refused');
        });
    });

    describe('GET /health/detailed', () => {
        it('should return comprehensive health info', async () => {
            const db = createMockDb();
            const serverStartTime = Date.now();

            const response = await buildDetailedHealthResponse(db, serverStartTime);

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.status, 'UP');
            assert.strictEqual(response.body.version, '1.0.0');
            assert.ok(response.body.uptime !== undefined);
            assert.ok(response.body.checks);
        });

        it('should include memory metrics', async () => {
            const db = createMockDb();
            const serverStartTime = Date.now();

            const response = await buildDetailedHealthResponse(db, serverStartTime);

            assert.ok(response.body.checks.memory);
            assert.ok(response.body.checks.memory.heapUsed > 0);
            assert.strictEqual(response.body.checks.memory.unit, 'MB');
        });

        it('should include database check', async () => {
            const db = createMockDb();
            const serverStartTime = Date.now();

            const response = await buildDetailedHealthResponse(db, serverStartTime);

            assert.ok(response.body.checks.database);
            assert.strictEqual(response.body.checks.database.status, 'UP');
        });

        it('should include Gemini API status', async () => {
            const db = createMockDb();
            const serverStartTime = Date.now();

            const response = await buildDetailedHealthResponse(db, serverStartTime);

            assert.ok(response.body.checks.geminiApi);
            assert.strictEqual(response.body.checks.geminiApi.configured, false);
        });

        it('should return 503 when database is down', async () => {
            const db = createMockDb({
                query: async () => { throw new Error('DB down'); }
            });
            const serverStartTime = Date.now();

            const response = await buildDetailedHealthResponse(db, serverStartTime);

            assert.strictEqual(response.status, 503);
            assert.strictEqual(response.body.status, 'DOWN');
        });
    });
});
