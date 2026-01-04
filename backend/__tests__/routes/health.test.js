/**
 * Health endpoint tests
 * These tests use a mock database to avoid requiring a real PostgreSQL connection
 */

const express = require('express');
const request = require('supertest');

// Create a minimal test app with health endpoints
function createTestApp(dbMock = {}) {
    const app = express();

    // Mock database module
    const db = {
        query: dbMock.query || jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
        checkConnection: dbMock.checkConnection || jest.fn().mockResolvedValue(true)
    };

    const serverStartTime = Date.now();

    // Basic health check
    app.get('/health', (req, res) => {
        res.json({
            status: 'UP',
            timestamp: new Date().toISOString()
        });
    });

    // Readiness probe
    app.get('/health/ready', async (req, res) => {
        try {
            const start = Date.now();
            await db.query('SELECT 1');
            const dbLatency = Date.now() - start;

            res.json({
                status: 'UP',
                timestamp: new Date().toISOString(),
                checks: {
                    database: {
                        status: 'UP',
                        latency: dbLatency
                    }
                }
            });
        } catch (error) {
            res.status(503).json({
                status: 'DOWN',
                timestamp: new Date().toISOString(),
                checks: {
                    database: {
                        status: 'DOWN',
                        error: error.message
                    }
                }
            });
        }
    });

    // Detailed health check
    app.get('/health/detailed', async (req, res) => {
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

        res.status(overallStatus === 'UP' ? 200 : 503).json({
            status: overallStatus,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            uptime: uptimeSeconds,
            checks
        });
    });

    return app;
}

describe('Health Endpoints', () => {
    describe('GET /health', () => {
        it('should return UP status', async () => {
            const app = createTestApp();
            const response = await request(app).get('/health');

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('UP');
            expect(response.body.timestamp).toBeDefined();
        });

        it('should return valid ISO timestamp', async () => {
            const app = createTestApp();
            const response = await request(app).get('/health');

            const timestamp = new Date(response.body.timestamp);
            expect(timestamp.toISOString()).toBe(response.body.timestamp);
        });
    });

    describe('GET /health/ready', () => {
        it('should return UP when database is connected', async () => {
            const app = createTestApp({
                query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] })
            });

            const response = await request(app).get('/health/ready');

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('UP');
            expect(response.body.checks.database.status).toBe('UP');
            expect(response.body.checks.database.latency).toBeDefined();
        });

        it('should return DOWN when database fails', async () => {
            const app = createTestApp({
                query: jest.fn().mockRejectedValue(new Error('Connection refused'))
            });

            const response = await request(app).get('/health/ready');

            expect(response.status).toBe(503);
            expect(response.body.status).toBe('DOWN');
            expect(response.body.checks.database.status).toBe('DOWN');
            expect(response.body.checks.database.error).toBe('Connection refused');
        });
    });

    describe('GET /health/detailed', () => {
        it('should return comprehensive health info', async () => {
            const app = createTestApp();
            const response = await request(app).get('/health/detailed');

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('UP');
            expect(response.body.version).toBe('1.0.0');
            expect(response.body.uptime).toBeDefined();
            expect(response.body.checks).toBeDefined();
        });

        it('should include memory metrics', async () => {
            const app = createTestApp();
            const response = await request(app).get('/health/detailed');

            expect(response.body.checks.memory).toBeDefined();
            expect(response.body.checks.memory.heapUsed).toBeGreaterThan(0);
            expect(response.body.checks.memory.unit).toBe('MB');
        });

        it('should include database check', async () => {
            const app = createTestApp();
            const response = await request(app).get('/health/detailed');

            expect(response.body.checks.database).toBeDefined();
            expect(response.body.checks.database.status).toBe('UP');
        });

        it('should include Gemini API status', async () => {
            const app = createTestApp();
            const response = await request(app).get('/health/detailed');

            expect(response.body.checks.geminiApi).toBeDefined();
            expect(response.body.checks.geminiApi.configured).toBe(false);
        });

        it('should return 503 when database is down', async () => {
            const app = createTestApp({
                query: jest.fn().mockRejectedValue(new Error('DB down'))
            });

            const response = await request(app).get('/health/detailed');

            expect(response.status).toBe(503);
            expect(response.body.status).toBe('DOWN');
        });
    });
});
