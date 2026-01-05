const { randomUUID } = require('crypto');

const LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

const levelName = {
    0: 'ERROR',
    1: 'WARN',
    2: 'INFO',
    3: 'DEBUG'
};

const activeLevel = () => {
    const envLevel = process.env.LOG_LEVEL ? process.env.LOG_LEVEL.toLowerCase() : 'info';
    return LEVELS[envLevel] !== undefined ? LEVELS[envLevel] : LEVELS.info;
};

const formatEntry = (level, message, metadata) => {
    const entry = {
        timestamp: new Date().toISOString(),
        level: levelName[level],
        message
    };

    if (metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0) {
        entry.metadata = metadata;
    }

    return JSON.stringify(entry);
};

const write = (stream, levelValue, message, metadata) => {
    if (levelValue > activeLevel()) {
        return;
    }

    const payload = formatEntry(levelValue, message, metadata);

    switch (levelValue) {
        case LEVELS.error:
            stream.error(payload);
            break;
        case LEVELS.warn:
            stream.warn(payload);
            break;
        default:
            stream.log(payload);
    }
};

const logger = {
    error: (message, metadata) => write(console, LEVELS.error, message, metadata),
    warn: (message, metadata) => write(console, LEVELS.warn, message, metadata),
    info: (message, metadata) => write(console, LEVELS.info, message, metadata),
    debug: (message, metadata) => write(console, LEVELS.debug, message, metadata)
};

const requestLogger = (req, res, next) => {
    const started = process.hrtime.bigint();
    const requestId = randomUUID();
    req.requestId = requestId;

    logger.info('Incoming request', {
        requestId,
        method: req.method,
        path: req.originalUrl,
        component: 'http'
    });

    res.on('finish', () => {
        const duration = Number(process.hrtime.bigint() - started) / 1e6;
        logger.info('Request completed', {
            requestId,
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            durationMs: duration.toFixed(2),
            component: 'http'
        });
    });

    res.on('close', () => {
        if (!res.writableEnded) {
            const duration = Number(process.hrtime.bigint() - started) / 1e6;
            logger.warn('Request aborted', {
                requestId,
                method: req.method,
                path: req.originalUrl,
                status: res.statusCode,
                durationMs: duration.toFixed(2),
                component: 'http'
            });
        }
    });

    next();
};

module.exports = {
    logger,
    requestLogger
};
