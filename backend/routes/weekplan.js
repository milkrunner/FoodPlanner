const express = require('express');
const router = express.Router();
const db = require('../db');
const { logger } = require('../utils/logger');

// Get current week plan
router.get('/', async (req, res) => {
    try {
        const { rows: weekPlans } = await db.query(
            'SELECT * FROM week_plans ORDER BY created_at DESC LIMIT 1'
        );

        if (weekPlans.length === 0) {
            return res.json(null);
        }

        const weekPlan = weekPlans[0];

        const { rows: daysWithMealsRows } = await db.query(
            `SELECT d.id AS day_id, d.date, d.day_name,
                    m.id AS meal_id, m.recipe_id, m.recipe_name, m.meal_type
             FROM days d
             LEFT JOIN meals m ON m.day_id = d.id
             WHERE d.week_plan_id = $1
             ORDER BY d.id`,
            [weekPlan.id]
        );

        const daysMap = new Map();
        for (const row of daysWithMealsRows) {
            if (!daysMap.has(row.day_id)) {
                daysMap.set(row.day_id, { date: row.date, dayName: row.day_name, meals: {} });
            }
            if (row.meal_type) {
                daysMap.get(row.day_id).meals[row.meal_type] = {
                    id: row.meal_id,
                    recipeId: row.recipe_id,
                    recipeName: row.recipe_name,
                    mealType: row.meal_type
                };
            }
        }

        res.json({
            id: weekPlan.id,
            startDate: weekPlan.start_date,
            mealPrepPlan: weekPlan.meal_prep_plan || {},
            days: Array.from(daysMap.values())
        });
    } catch (error) {
        logger.error('Error fetching week plan', { error: error.message, requestId: req.requestId, component: 'weekplan' });
        res.status(500).json({ error: error.message });
    }
});

// Save week plan (supports multiple weeks)
router.post('/', async (req, res) => {
    const { id, startDate, days, mealPrepPlan } = req.body;
    const sanitizedMealPrepPlan = mealPrepPlan && typeof mealPrepPlan === 'object' ? mealPrepPlan : {};

    try {
        await db.transaction(async (client) => {
            // Delete existing week plan with the same ID
            await client.query('DELETE FROM week_plans WHERE id = $1', [id]);

            // Insert new week plan
            await client.query(
                'INSERT INTO week_plans (id, start_date, meal_prep_plan) VALUES ($1, $2, $3)',
                [id, startDate, sanitizedMealPrepPlan]
            );

            // Insert days and meals
            for (const day of days) {
                const { rows } = await client.query(
                    'INSERT INTO days (week_plan_id, date, day_name) VALUES ($1, $2, $3) RETURNING id',
                    [id, day.date, day.dayName]
                );

                const dayId = rows[0].id;

                // Insert meals for this day
                for (const [mealType, meal] of Object.entries(day.meals || {})) {
                    await client.query(
                        'INSERT INTO meals (id, day_id, recipe_id, recipe_name, meal_type) VALUES ($1, $2, $3, $4, $5)',
                        [meal.id, dayId, meal.recipeId, meal.recipeName, mealType]
                    );
                }
            }
        });

        res.status(201).json({ message: 'Week plan saved successfully' });
    } catch (error) {
        logger.error('Error saving week plan', { error: error.message, requestId: req.requestId, component: 'weekplan' });
        res.status(500).json({ error: error.message });
    }
});

// Delete week plan by ID
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { rowCount } = await db.query('DELETE FROM week_plans WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Week plan not found' });
        }
        res.json({ message: 'Week plan deleted successfully' });
    } catch (error) {
        logger.error('Error deleting week plan', { error: error.message, requestId: req.requestId, component: 'weekplan' });
        res.status(500).json({ error: 'Failed to delete week plan' });
    }
});

// Get week plan by date (finds week containing the given date)
// NOTE: This route must be defined BEFORE /:id-style routes
router.get('/by-date/:date', async (req, res) => {
    try {
        // Parse date string directly - expected format: YYYY-MM-DD
        const dateStr = req.params.date.split('T')[0];

        // Find the week plan where the requested date falls within the 7-day range
        const { rows: weekPlans } = await db.query(
            `SELECT * FROM week_plans
             WHERE start_date::date <= $1::date
             AND start_date::date + interval '6 days' >= $1::date
             ORDER BY start_date DESC
             LIMIT 1`,
            [dateStr]
        );

        if (weekPlans.length === 0) {
            return res.status(404).json({ error: 'Week plan not found' });
        }

        const weekPlan = weekPlans[0];

        const { rows: daysWithMealsRows } = await db.query(
            `SELECT d.id AS day_id, d.date, d.day_name,
                    m.id AS meal_id, m.recipe_id, m.recipe_name, m.meal_type
             FROM days d
             LEFT JOIN meals m ON m.day_id = d.id
             WHERE d.week_plan_id = $1
             ORDER BY d.id`,
            [weekPlan.id]
        );

        const daysMap = new Map();
        for (const row of daysWithMealsRows) {
            if (!daysMap.has(row.day_id)) {
                daysMap.set(row.day_id, { date: row.date, dayName: row.day_name, meals: {} });
            }
            if (row.meal_type) {
                daysMap.get(row.day_id).meals[row.meal_type] = {
                    id: row.meal_id,
                    recipeId: row.recipe_id,
                    recipeName: row.recipe_name,
                    mealType: row.meal_type
                };
            }
        }

        res.json({
            id: weekPlan.id,
            startDate: weekPlan.start_date,
            mealPrepPlan: weekPlan.meal_prep_plan || {},
            days: Array.from(daysMap.values())
        });
    } catch (error) {
        logger.error('Error fetching week plan by date', { error: error.message, date: req.params.date, requestId: req.requestId, component: 'weekplan' });
        res.status(500).json({ error: error.message });
    }
});

// ========== TEMPLATES ==========

// Get all templates
router.get('/templates', async (req, res) => {
    try {
        const { rows: templates } = await db.query(
            'SELECT * FROM week_plan_templates ORDER BY created_at DESC'
        );

        const parsedTemplates = templates.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
            templateData: t.template_data,
            createdAt: t.created_at,
            updatedAt: t.updated_at
        }));

        res.json(parsedTemplates);
    } catch (error) {
        logger.error('Error fetching templates', { error: error.message, requestId: req.requestId, component: 'templates' });
        res.status(500).json({ error: error.message });
    }
});

// Get template by ID
router.get('/templates/:id', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM week_plan_templates WHERE id = $1',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const template = rows[0];
        res.json({
            id: template.id,
            name: template.name,
            description: template.description,
            templateData: template.template_data,
            createdAt: template.created_at,
            updatedAt: template.updated_at
        });
    } catch (error) {
        logger.error('Error fetching template', { error: error.message, templateId: req.params.id, requestId: req.requestId, component: 'templates' });
        res.status(500).json({ error: error.message });
    }
});

// Save template
router.post('/templates', async (req, res) => {
    const { id, name, description, templateData } = req.body;

    if (!name || !templateData) {
        return res.status(400).json({ error: 'Name and template data are required' });
    }

    try {
        await db.query(
            'INSERT INTO week_plan_templates (id, name, description, template_data) VALUES ($1, $2, $3, $4)',
            [id, name, description || '', templateData]
        );

        res.status(201).json({
            message: 'Template saved successfully',
            id: id
        });
    } catch (error) {
        logger.error('Error saving template', { error: error.message, requestId: req.requestId, component: 'templates' });
        res.status(500).json({ error: error.message });
    }
});

// Update template
router.put('/templates/:id', async (req, res) => {
    const { name, description, templateData } = req.body;

    if (!name || !templateData) {
        return res.status(400).json({ error: 'Name and template data are required' });
    }

    try {
        const { rowCount } = await db.query(
            'UPDATE week_plan_templates SET name = $1, description = $2, template_data = $3 WHERE id = $4',
            [name, description || '', templateData, req.params.id]
        );

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json({ message: 'Template updated successfully' });
    } catch (error) {
        logger.error('Error updating template', { error: error.message, templateId: req.params.id, requestId: req.requestId, component: 'templates' });
        res.status(500).json({ error: error.message });
    }
});

// Delete template
router.delete('/templates/:id', async (req, res) => {
    try {
        const { rowCount } = await db.query(
            'DELETE FROM week_plan_templates WHERE id = $1',
            [req.params.id]
        );

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json({ message: 'Template deleted successfully' });
    } catch (error) {
        logger.error('Error deleting template', { error: error.message, templateId: req.params.id, requestId: req.requestId, component: 'templates' });
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
