const express = require('express');
const router = express.Router();
const db = require('../db');
const { logger } = require('../utils/logger');
const { hashPassword, validatePassword } = require('../utils/auth');
const { authenticateRequired, requireAdmin } = require('../middleware/authenticate');

// All admin routes require authentication + admin role
router.use(authenticateRequired, requireAdmin);

// GET /admin/users — list all users with pagination
router.get('/users', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const offset = (page - 1) * limit;

        const countResult = await db.query('SELECT COUNT(*) FROM users');
        const total = parseInt(countResult.rows[0].count);

        const result = await db.query(
            'SELECT id, email, name, role, is_active, created_at, last_login_at FROM users ORDER BY created_at ASC LIMIT $1 OFFSET $2',
            [limit, offset]
        );

        res.json({
            users: result.rows,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        logger.error('Admin list users error', { error: error.message, component: 'admin' });
        res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
    }
});

// PUT /admin/users/:id/role — change user role
router.put('/users/:id/role', async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Ungültige Rolle. Erlaubt: user, admin' });
        }

        if (id === req.user.id) {
            return res.status(400).json({ error: 'Du kannst deine eigene Rolle nicht ändern' });
        }

        const result = await db.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, name, role, is_active',
            [role, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        logger.info('Admin changed user role', { targetUserId: id, newRole: role, adminId: req.user.id, component: 'admin' });
        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Admin change role error', { error: error.message, component: 'admin' });
        res.status(500).json({ error: 'Fehler beim Ändern der Rolle' });
    }
});

// PUT /admin/users/:id/status — activate/deactivate user
router.put('/users/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        if (typeof is_active !== 'boolean') {
            return res.status(400).json({ error: 'is_active muss ein Boolean sein' });
        }

        if (id === req.user.id) {
            return res.status(400).json({ error: 'Du kannst dich nicht selbst deaktivieren' });
        }

        const result = await db.query(
            'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, email, name, role, is_active',
            [is_active, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        logger.info('Admin changed user status', { targetUserId: id, is_active, adminId: req.user.id, component: 'admin' });
        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Admin change status error', { error: error.message, component: 'admin' });
        res.status(500).json({ error: 'Fehler beim Ändern des Status' });
    }
});

// PUT /admin/users/:id/reset-password — reset user password
router.put('/users/:id/reset-password', async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        const pwCheck = validatePassword(password);
        if (!pwCheck.valid) {
            return res.status(400).json({ error: pwCheck.error });
        }

        const passwordHash = await hashPassword(password);
        const result = await db.query(
            'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, email, name',
            [passwordHash, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        logger.info('Admin reset user password', { targetUserId: id, adminId: req.user.id, component: 'admin' });
        res.json({ message: 'Passwort erfolgreich zurückgesetzt' });
    } catch (error) {
        logger.error('Admin reset password error', { error: error.message, component: 'admin' });
        res.status(500).json({ error: 'Fehler beim Zurücksetzen des Passworts' });
    }
});

// DELETE /admin/users/:id — delete user
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (id === req.user.id) {
            return res.status(400).json({ error: 'Du kannst dich nicht selbst löschen' });
        }

        const result = await db.query(
            'DELETE FROM users WHERE id = $1 RETURNING id, email',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        logger.info('Admin deleted user', { targetUserId: id, adminId: req.user.id, component: 'admin' });
        res.json({ message: 'Benutzer erfolgreich gelöscht' });
    } catch (error) {
        logger.error('Admin delete user error', { error: error.message, component: 'admin' });
        res.status(500).json({ error: 'Fehler beim Löschen des Benutzers' });
    }
});

module.exports = router;
