const express = require('express');
const router = express.Router();
const db = require('../db');
const { formatUptime } = require('../utils/formatting');
const { genAI } = require('../utils/gemini');

// Track server start time for uptime calculation
const serverStartTime = Date.now();

// Basic health check - fast response for load balancers (< 100ms)
router.get('/', (req, res) => {
    res.json({
        status: 'UP',
        timestamp: new Date().toISOString()
    });
});

// Readiness probe - checks if app is ready to serve traffic (includes DB check)
router.get('/ready', async (req, res) => {
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
                    error: process.env.NODE_ENV === 'production'
                        ? 'Internal server error'
                        : error.message
                }
            }
        });
    }
});

// Detailed health check - comprehensive system status
router.get('/detailed', async (req, res) => {
    const checks = {};
    let overallStatus = 'UP';

    // Database check
    try {
        const start = Date.now();
        await db.query('SELECT 1');
        const dbLatency = Date.now() - start;
        checks.database = {
            status: 'UP',
            latency: dbLatency
        };
    } catch (error) {
        checks.database = {
            status: 'DOWN',
            error: process.env.NODE_ENV === 'production'
                ? 'Internal server error'
                : error.message
        };
        overallStatus = 'DOWN';
    }

    // Gemini API check
    checks.geminiApi = {
        status: genAI ? 'UP' : 'UNCONFIGURED',
        configured: !!genAI
    };

    // Memory usage
    const memUsage = process.memoryUsage();
    checks.memory = {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        unit: 'MB'
    };

    // Uptime
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

    // Version from package.json
    const packageJson = require('../package.json');

    const statusCode = overallStatus === 'UP' ? 200 : 503;
    res.status(statusCode).json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: packageJson.version,
        uptime: uptimeSeconds,
        uptimeHuman: formatUptime(uptimeSeconds),
        checks
    });
});

module.exports = router;
