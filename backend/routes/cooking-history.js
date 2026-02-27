const express = require('express');
const router = express.Router();
const db = require('../db');
const { logger } = require('../utils/logger');
const { authenticateRequired } = require('../middleware/authenticate');

// Get cooking history (paginated)
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const { rows } = await db.query(`
            SELECT ch.id, ch.recipe_id, ch.cooked_at, ch.servings, ch.notes,
                   r.name as recipe_name, r.category as recipe_category
            FROM cooking_history ch
            LEFT JOIN recipes r ON ch.recipe_id = r.id
            ORDER BY ch.cooked_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const { rows: countResult } = await db.query('SELECT COUNT(*) FROM cooking_history');
        const total = parseInt(countResult[0].count);

        res.json({
            entries: rows,
            total,
            limit,
            offset
        });
    } catch (error) {
        logger.error('Error fetching cooking history', { error: error.message, requestId: req.requestId, component: 'cooking-history' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Get cooking stats for all recipes
router.get('/stats', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT
                r.id as recipe_id,
                r.name as recipe_name,
                COUNT(ch.id) as times_cooked,
                MAX(ch.cooked_at) as last_cooked_at
            FROM recipes r
            LEFT JOIN cooking_history ch ON r.id = ch.recipe_id
            GROUP BY r.id, r.name
            ORDER BY times_cooked DESC, r.name ASC
        `);

        res.json(rows);
    } catch (error) {
        logger.error('Error fetching cooking stats', { error: error.message, requestId: req.requestId, component: 'cooking-history' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Get cooking history for a specific recipe
router.get('/recipe/:recipeId', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT id, recipe_id, cooked_at, servings, notes
            FROM cooking_history
            WHERE recipe_id = $1
            ORDER BY cooked_at DESC
        `, [req.params.recipeId]);

        res.json(rows);
    } catch (error) {
        logger.error('Error fetching recipe cooking history', { error: error.message, recipeId: req.params.recipeId, requestId: req.requestId, component: 'cooking-history' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Mark recipe as cooked
router.post('/', authenticateRequired, async (req, res) => {
    const { recipeId, servings, notes } = req.body;

    if (!recipeId) {
        return res.status(400).json({ error: 'Recipe ID is required' });
    }

    try {
        // Verify recipe exists
        const { rows: recipeCheck } = await db.query(
            'SELECT id, name FROM recipes WHERE id = $1',
            [recipeId]
        );

        if (recipeCheck.length === 0) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        const { rows } = await db.query(`
            INSERT INTO cooking_history (recipe_id, servings, notes)
            VALUES ($1, $2, $3)
            RETURNING id, recipe_id, cooked_at, servings, notes
        `, [recipeId, servings || null, notes || null]);

        res.status(201).json({
            ...rows[0],
            recipe_name: recipeCheck[0].name
        });
    } catch (error) {
        logger.error('Error marking recipe as cooked', { error: error.message, recipeId: req.body.recipeId, requestId: req.requestId, component: 'cooking-history' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Delete cooking history entry
router.delete('/:id', authenticateRequired, async (req, res) => {
    try {
        const { rowCount } = await db.query(
            'DELETE FROM cooking_history WHERE id = $1',
            [req.params.id]
        );

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        res.json({ message: 'Entry deleted successfully' });
    } catch (error) {
        logger.error('Error deleting cooking history entry', { error: error.message, entryId: req.params.id, requestId: req.requestId, component: 'cooking-history' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Get recipes that haven't been cooked recently
router.get('/not-cooked-recently', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;

        const { rows } = await db.query(`
            SELECT r.id, r.name, r.category,
                   MAX(ch.cooked_at) as last_cooked_at,
                   COUNT(ch.id) as times_cooked
            FROM recipes r
            LEFT JOIN cooking_history ch ON r.id = ch.recipe_id
            GROUP BY r.id, r.name, r.category
            HAVING MAX(ch.cooked_at) IS NULL
               OR MAX(ch.cooked_at) < CURRENT_TIMESTAMP - INTERVAL '1 day' * $1
            ORDER BY last_cooked_at ASC NULLS FIRST, r.name ASC
        `, [days]);

        res.json(rows);
    } catch (error) {
        logger.error('Error fetching not recently cooked recipes', { error: error.message, days: req.query.days, requestId: req.requestId, component: 'cooking-history' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

module.exports = router;
