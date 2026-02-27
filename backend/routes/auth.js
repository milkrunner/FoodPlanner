const express = require('express');
const router = express.Router();
const db = require('../db');
const { logger } = require('../utils/logger');
const { validateEmail, validatePassword, hashPassword, verifyPassword, generateToken } = require('../utils/auth');
const { authenticateRequired } = require('../middleware/authenticate');
const { authLimiter } = require('../middleware/rate-limiters');

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
            'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
            [email.trim().toLowerCase(), passwordHash, name ? name.trim() : null]
        );

        const user = result.rows[0];
        const token = generateToken(user);
        logger.info('User registered', { userId: user.id, component: 'auth' });
        res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
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
            'SELECT id, email, name, password_hash FROM users WHERE email = $1',
            [email.trim().toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Ungültige E-Mail oder Passwort' });
        }

        const user = result.rows[0];
        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Ungültige E-Mail oder Passwort' });
        }

        const token = generateToken(user);
        logger.info('User logged in', { userId: user.id, component: 'auth' });
        res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error) {
        logger.error('Login error', { error: error.message, component: 'auth' });
        res.status(500).json({ error: 'Anmeldung fehlgeschlagen' });
    }
});

// GET /auth/me — returns current user info
router.get('/me', authenticateRequired, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, email, name, created_at FROM users WHERE id = $1',
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

// POST /auth/logout — stateless JWT; client must discard the token
router.post('/logout', (req, res) => {
    res.json({ message: 'Erfolgreich abgemeldet' });
});

module.exports = router;
