const express = require('express');
const router = express.Router();
const db = require('../db');
const { logger } = require('../utils/logger');
const { authenticateRequired } = require('../middleware/authenticate');

router.get('/', authenticateRequired, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM pantry_items ORDER BY expiry_date ASC NULLS LAST, name ASC'
        );
        res.json(result.rows);
    } catch (error) {
        logger.error('Error fetching pantry items', { error: error.message, requestId: req.requestId, component: 'pantry' });
        res.status(500).json({ error: 'Failed to fetch pantry items' });
    }
});

router.get('/expiring', authenticateRequired, async (req, res) => {
    const days = parseInt(req.query.days) || 3;
    try {
        const result = await db.query(
            `SELECT * FROM pantry_items
             WHERE expiry_date IS NOT NULL
               AND expiry_date <= CURRENT_DATE + $1 * INTERVAL '1 day'
             ORDER BY expiry_date ASC`,
            [days]
        );
        res.json(result.rows);
    } catch (error) {
        logger.error('Error fetching expiring pantry items', { error: error.message, requestId: req.requestId, component: 'pantry' });
        res.status(500).json({ error: 'Failed to fetch expiring pantry items' });
    }
});

router.post('/', authenticateRequired, async (req, res) => {
    const { name, quantity, unit, category, location, purchase_date, expiry_date, notes } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name ist erforderlich' });
    }
    try {
        const result = await db.query(
            `INSERT INTO pantry_items (name, quantity, unit, category, location, purchase_date, expiry_date, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                name.trim(),
                quantity || null,
                unit || null,
                category || null,
                location || null,
                purchase_date || null,
                expiry_date || null,
                notes || null
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        logger.error('Error creating pantry item', { error: error.message, requestId: req.requestId, component: 'pantry' });
        res.status(500).json({ error: 'Failed to create pantry item' });
    }
});

router.put('/:id', authenticateRequired, async (req, res) => {
    const { id } = req.params;
    const { name, quantity, unit, category, location, purchase_date, expiry_date, notes } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name ist erforderlich' });
    }
    try {
        const result = await db.query(
            `UPDATE pantry_items
             SET name = $1, quantity = $2, unit = $3, category = $4, location = $5,
                 purchase_date = $6, expiry_date = $7, notes = $8, updated_at = CURRENT_TIMESTAMP
             WHERE id = $9
             RETURNING *`,
            [
                name.trim(),
                quantity || null,
                unit || null,
                category || null,
                location || null,
                purchase_date || null,
                expiry_date || null,
                notes || null,
                id
            ]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pantry item not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        logger.error('Error updating pantry item', { error: error.message, requestId: req.requestId, component: 'pantry' });
        res.status(500).json({ error: 'Failed to update pantry item' });
    }
});

router.delete('/:id', authenticateRequired, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(
            'DELETE FROM pantry_items WHERE id = $1 RETURNING id',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pantry item not found' });
        }
        res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        logger.error('Error deleting pantry item', { error: error.message, requestId: req.requestId, component: 'pantry' });
        res.status(500).json({ error: 'Failed to delete pantry item' });
    }
});

module.exports = router;
