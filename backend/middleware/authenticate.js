/**
 * JWT authentication middleware
 */

const { verifyToken, extractBearerToken } = require('../utils/auth');

/**
 * Middleware: requires a valid JWT. Returns 401 if missing or invalid.
 */
function authenticateRequired(req, res, next) {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
        return res.status(401).json({ error: 'Authentifizierung erforderlich' });
    }

    const payload = verifyToken(token);
    if (!payload) {
        return res.status(401).json({ error: 'Ungültiger oder abgelaufener Token' });
    }

    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
}

/**
 * Middleware: reads JWT if present, sets req.user, but never blocks the request.
 */
function authenticateOptional(req, res, next) {
    const token = extractBearerToken(req.headers.authorization);
    if (token) {
        const payload = verifyToken(token);
        if (payload) {
            req.user = { id: payload.sub, email: payload.email, name: payload.name };
        }
    }
    next();
}

module.exports = { authenticateRequired, authenticateOptional };
