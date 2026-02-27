/**
 * Rate limiter middleware configurations
 */

const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');

// Skip rate limiting for local/Docker development
function isLocalRequest(req) {
    const ip = req.ip;
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' ||
           ip.startsWith('172.') || ip.startsWith('::ffff:172.');
}

// General API Rate Limiting
// Limit: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        error: 'Too many requests from this IP, please try again after 15 minutes.',
        retryAfter: '15 minutes'
    },
    // Skip rate limiting for local development
    skip: isLocalRequest,
    handler: (req, res) => {
        logger.warn('General API rate limit exceeded', {
            component: 'rate-limit',
            ip: req.ip,
            method: req.method,
            path: req.path,
            requestId: req.requestId
        });
        res.status(429).json({
            error: 'Too many requests from this IP, please try again after 15 minutes.',
            retryAfter: '15 minutes'
        });
    }
});

// AI Endpoints Rate Limiting (stricter)
// Limit: 20 AI requests per 15 minutes per IP
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 AI requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many AI requests from this IP. AI endpoints are limited to 20 requests per 15 minutes.',
        retryAfter: '15 minutes'
    },
    skip: isLocalRequest,
    handler: (req, res) => {
        logger.warn('AI API rate limit exceeded', {
            component: 'rate-limit',
            ip: req.ip,
            method: req.method,
            path: req.path,
            requestId: req.requestId
        });
        res.status(429).json({
            error: 'Too many AI requests from this IP. AI endpoints are limited to 20 requests per 15 minutes.',
            retryAfter: '15 minutes'
        });
    }
});

// Stricter rate limiter for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: isLocalRequest,
    handler: (req, res) => {
        res.status(429).json({ error: 'Zu viele Anmeldeversuche. Bitte warte 15 Minuten.' });
    }
});

module.exports = {
    generalLimiter,
    aiLimiter,
    authLimiter
};
