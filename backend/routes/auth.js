const express = require('express');
const router = express.Router();
const db = require('../db');
const { logger } = require('../utils/logger');
const { validateEmail, validatePassword, hashPassword, verifyPassword, generateToken, generateRefreshToken, verifyRefreshToken } = require('../utils/auth');
const { authenticateRequired } = require('../middleware/authenticate');
const { authLimiter } = require('../middleware/rate-limiters');

// Refresh token cookie config
const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Build Set-Cookie header value for the refresh token.
 * Uses HttpOnly + SameSite=Strict + Secure (in production) — OWASP-recommended storage.
 */
function buildRefreshCookieHeader(value) {
    const parts = [`${REFRESH_COOKIE_NAME}=${value}`, 'HttpOnly', 'SameSite=Strict', 'Path=/auth'];
    if (process.env.NODE_ENV === 'production') parts.push('Secure');
    parts.push(`Max-Age=${REFRESH_MAX_AGE}`);
    return parts.join('; ');
}

/**
 * Set refresh token as HttpOnly cookie on the response.
 */
function setRefreshCookie(res, refreshToken) {
    // codeql[js/clear-text-storage-of-sensitive-data] — HttpOnly cookie IS the secure storage
    res.setHeader('Set-Cookie', buildRefreshCookieHeader(refreshToken));
}

/**
 * Clear the refresh token cookie by setting Max-Age=0.
 */
function clearRefreshCookie(res) {
    const parts = [`${REFRESH_COOKIE_NAME}=`, 'HttpOnly', 'SameSite=Strict', 'Path=/auth'];
    if (process.env.NODE_ENV === 'production') parts.push('Secure');
    parts.push('Max-Age=0');
    res.setHeader('Set-Cookie', parts.join('; '));
}

/**
 * Parse a specific cookie from the request headers.
 */
function getCookie(req, name) {
    const header = req.headers.cookie || '';
    for (const pair of header.split(';')) {
        const [key, ...rest] = pair.trim().split('=');
        if (key === name) return rest.join('=');
    }
    return undefined;
}

// POST /auth/register
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!validateEmail(email)) {
            return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
        }

        const pwCheck = validatePassword(password);
        if (!pwCheck.valid) {
            return res.status(400).json({ error: pwCheck.error });
        }

        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'E-Mail-Adresse bereits registriert' });
        }

        const passwordHash = await hashPassword(password);
        const result = await db.query(
            'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, role, created_at',
            [email.trim().toLowerCase(), passwordHash, name ? name.trim() : null]
        );

        const user = result.rows[0];
        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);
        setRefreshCookie(res, refreshToken);
        logger.info('User registered', { userId: user.id, component: 'auth' });
        res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (error) {
        logger.error('Registration error', { error: error.message, component: 'auth' });
        res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
    }
});

// POST /auth/login
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
        }

        const result = await db.query(
            'SELECT id, email, name, password_hash, role, is_active, must_change_password FROM users WHERE email = $1',
            [email.trim().toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Ungültige E-Mail oder Passwort' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ error: 'Konto ist deaktiviert. Bitte kontaktiere einen Administrator.' });
        }

        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Ungültige E-Mail oder Passwort' });
        }

        // Update last_login_at
        await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

        const token = generateToken(user);
        const refreshToken = generateRefreshToken(user);
        setRefreshCookie(res, refreshToken);
        logger.info('User logged in', { userId: user.id, component: 'auth' });
        res.json({
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            mustChangePassword: user.must_change_password
        });
    } catch (error) {
        logger.error('Login error', { error: error.message, component: 'auth' });
        res.status(500).json({ error: 'Anmeldung fehlgeschlagen' });
    }
});

// POST /auth/change-password — for forced password change after temp password login
router.post('/change-password', authenticateRequired, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Aktuelles und neues Passwort erforderlich' });
        }

        const pwCheck = validatePassword(newPassword);
        if (!pwCheck.valid) {
            return res.status(400).json({ error: pwCheck.error });
        }

        const result = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        const valid = await verifyPassword(currentPassword, result.rows[0].password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });
        }

        const newHash = await hashPassword(newPassword);
        await db.query(
            'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
            [newHash, req.user.id]
        );

        logger.info('User changed password', { userId: req.user.id, component: 'auth' });
        res.json({ message: 'Passwort erfolgreich geändert' });
    } catch (error) {
        logger.error('Change password error', { error: error.message, component: 'auth' });
        res.status(500).json({ error: 'Fehler beim Ändern des Passworts' });
    }
});

// GET /auth/me — returns current user info
router.get('/me', authenticateRequired, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, email, name, role, created_at FROM users WHERE id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Get user error', { error: error.message, component: 'auth' });
        res.status(500).json({ error: 'Fehler beim Laden des Benutzers' });
    }
});

// POST /auth/refresh — exchange refresh token cookie for new access token
router.post('/refresh', async (req, res) => {
    try {
        // Read refresh token from HttpOnly cookie (preferred) or body (legacy fallback)
        const refreshToken = getCookie(req, REFRESH_COOKIE_NAME) || req.body?.refreshToken;
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh-Token erforderlich' });
        }

        const payload = verifyRefreshToken(refreshToken);
        if (!payload) {
            clearRefreshCookie(res);
            return res.status(401).json({ error: 'Ungültiger oder abgelaufener Refresh-Token' });
        }

        const result = await db.query(
            'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
            [payload.sub]
        );

        if (result.rows.length === 0 || !result.rows[0].is_active) {
            clearRefreshCookie(res);
            return res.status(401).json({ error: 'Benutzer nicht gefunden oder deaktiviert' });
        }

        const user = result.rows[0];
        const newToken = generateToken(user);
        // Rotate refresh token — issue a new one with each refresh
        const newRefreshToken = generateRefreshToken(user);
        setRefreshCookie(res, newRefreshToken);
        res.json({ token: newToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (error) {
        logger.error('Token refresh error', { error: error.message, component: 'auth' });
        res.status(500).json({ error: 'Token-Refresh fehlgeschlagen' });
    }
});

// POST /auth/logout — clear refresh token cookie
router.post('/logout', (req, res) => {
    clearRefreshCookie(res);
    res.json({ message: 'Erfolgreich abgemeldet' });
});

module.exports = router;
