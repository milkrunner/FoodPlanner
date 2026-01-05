/**
 * Structured Logging without external dependencies
 * Provides JSON-formatted logs with request tracing support
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Log levels with numeric priority
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

// ANSI color codes for console output
const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    gray: '\x1b[90m',
    cyan: '\x1b[36m'
};

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';
const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL] ?? (isProduction ? LOG_LEVELS.info : LOG_LEVELS.debug);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// File streams for logging
let errorStream = null;
let combinedStream = null;

function getErrorStream() {
    if (!errorStream) {
        errorStream = fs.createWriteStream(path.join(logsDir, 'error.log'), { flags: 'a' });
    }
    return errorStream;
}

function getCombinedStream() {
    if (!combinedStream) {
        combinedStream = fs.createWriteStream(path.join(logsDir, 'combined.log'), { flags: 'a' });
    }
    return combinedStream;
}

/**
 * Format log entry for console (colored, human-readable)
 */
function formatConsole(level, message, meta) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const requestId = meta.requestId ? `[${meta.requestId.substring(0, 8)}]` : '';
    
    // Remove service and requestId from meta for display
    const { service, requestId: _, ...displayMeta } = meta;
    const metaStr = Object.keys(displayMeta).length ? ` ${JSON.stringify(displayMeta)}` : '';
    
    let color;
    switch (level) {
        case 'error': color = COLORS.red; break;
        case 'warn': color = COLORS.yellow; break;
        case 'info': color = COLORS.blue; break;
        case 'debug': color = COLORS.gray; break;
        default: color = COLORS.reset;
    }
    
    return `${COLORS.gray}${timestamp}${COLORS.reset} ${color}${level.toUpperCase().padEnd(5)}${COLORS.reset} ${COLORS.cyan}${requestId}${COLORS.reset} ${message}${COLORS.gray}${metaStr}${COLORS.reset}`;
}

/**
 * Format log entry as JSON
 */
function formatJson(level, message, meta) {
    return JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        service: 'food-planner-api',
        ...meta
    });
}

/**
 * Write log entry
 */
function log(level, message, meta = {}) {
    // Check if this level should be logged
    if (LOG_LEVELS[level] > currentLogLevel) {
        return;
    }
    
    const jsonLine = formatJson(level, message, meta);
    
    // Write to console
    if (isProduction) {
        console.log(jsonLine);
    } else {
        console.log(formatConsole(level, message, meta));
    }
    
    // Write to combined log file
    try {
        getCombinedStream().write(jsonLine + '\n');
    } catch (e) {
        // Ignore file write errors
    }
    
    // Write errors to error log file
    if (level === 'error') {
        try {
            getErrorStream().write(jsonLine + '\n');
        } catch (e) {
            // Ignore file write errors
        }
    }
}

/**
 * Logger instance with level methods
 */
const logger = {
    error: (message, meta) => log('error', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    info: (message, meta) => log('info', message, meta),
    debug: (message, meta) => log('debug', message, meta)
};

/**
 * Generate a unique request ID using crypto
 * @returns {string} UUID-like string
 */
function generateRequestId() {
    return crypto.randomUUID();
}

/**
 * Express middleware to add request ID and logging context
 */
function requestLogger(req, res, next) {
    // Generate or use existing request ID
    req.requestId = req.headers['x-request-id'] || generateRequestId();
    
    // Add request ID to response headers
    res.setHeader('X-Request-ID', req.requestId);
    
    // Store start time for duration calculation
    req.startTime = Date.now();
    
    // Log incoming request
    logger.info('Request received', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        query: Object.keys(req.query).length ? req.query : undefined,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    
    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        const logData = {
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration
        };
        
        if (res.statusCode >= 500) {
            logger.error('Request completed with server error', logData);
        } else if (res.statusCode >= 400) {
            logger.warn('Request completed with client error', logData);
        } else {
            logger.info('Request completed', logData);
        }
    });
    
    next();
}

/**
 * Create a child logger with request context
 * @param {string} requestId - The request ID
 * @returns {object} Child logger with request ID attached
 */
function createRequestLogger(requestId) {
    return {
        debug: (message, meta = {}) => logger.debug(message, { requestId, ...meta }),
        info: (message, meta = {}) => logger.info(message, { requestId, ...meta }),
        warn: (message, meta = {}) => logger.warn(message, { requestId, ...meta }),
        error: (message, meta = {}) => logger.error(message, { requestId, ...meta })
    };
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { 
        error: error.message, 
        stack: error.stack,
        component: 'process'
    });
    try {
        fs.appendFileSync(path.join(logsDir, 'exceptions.log'), 
            formatJson('error', 'Uncaught Exception', { error: error.message, stack: error.stack }) + '\n'
        );
    } catch (e) {
        // Ignore
    }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error('Unhandled Rejection', { 
        error: error.message, 
        stack: error.stack,
        component: 'process'
    });
    try {
        fs.appendFileSync(path.join(logsDir, 'rejections.log'), 
            formatJson('error', 'Unhandled Rejection', { error: error.message, stack: error.stack }) + '\n'
        );
    } catch (e) {
        // Ignore
    }
});

module.exports = {
    logger,
    generateRequestId,
    requestLogger,
    createRequestLogger
};
