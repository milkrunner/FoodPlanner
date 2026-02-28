const express = require('express');
const router = express.Router();
const db = require('../db');
const { logger } = require('../utils/logger');
const { genAI } = require('../utils/gemini');
const { aiLimiter } = require('../middleware/rate-limiters');
const { sanitizeForPrompt, extractJsonFromAiResponse } = require('../utils/ai-sanitize');
const { authenticateRequired } = require('../middleware/authenticate');

// ========== MANUAL SHOPPING ITEMS ==========

// Get all manual shopping items
router.get('/manual', authenticateRequired, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM manual_shopping_items ORDER BY created_at DESC'
        );
        res.json(rows);
    } catch (error) {
        logger.error('Error fetching manual shopping items', { error: error.message, requestId: req.requestId, component: 'shopping' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Add manual shopping item
router.post('/manual', authenticateRequired, async (req, res) => {
    const { id, name, amount, unit, category } = req.body;

    if (!name || !amount || !unit) {
        return res.status(400).json({ error: 'Name, amount and unit are required' });
    }

    try {
        await db.query(
            'INSERT INTO manual_shopping_items (id, name, amount, unit, category) VALUES ($1, $2, $3, $4, $5)',
            [id, name, amount, unit, category || 'Sonstiges']
        );

        res.status(201).json({
            message: 'Manual shopping item added successfully',
            id: id
        });
    } catch (error) {
        logger.error('Error adding manual shopping item', { error: error.message, requestId: req.requestId, component: 'shopping' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Delete manual shopping item
router.delete('/manual/:id', authenticateRequired, async (req, res) => {
    try {
        const { rowCount } = await db.query(
            'DELETE FROM manual_shopping_items WHERE id = $1',
            [req.params.id]
        );

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json({ message: 'Manual shopping item deleted successfully' });
    } catch (error) {
        logger.error('Error deleting manual shopping item', { error: error.message, itemId: req.params.id, requestId: req.requestId, component: 'shopping' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Delete all manual shopping items
router.delete('/manual', authenticateRequired, async (req, res) => {
    try {
        await db.query('DELETE FROM manual_shopping_items');
        res.json({ message: 'All manual shopping items deleted successfully' });
    } catch (error) {
        logger.error('Error deleting all manual shopping items', { error: error.message, requestId: req.requestId, component: 'shopping' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// ========== BUDGET ==========

// Get budget for a specific week
router.get('/budget/:weekStart', authenticateRequired, async (req, res) => {
    try {
        const { weekStart } = req.params;
        const { rows } = await db.query(
            'SELECT * FROM shopping_budget WHERE week_start = $1',
            [weekStart]
        );

        if (rows.length === 0) {
            return res.json(null);
        }

        res.json(rows[0]);
    } catch (error) {
        logger.error('Error fetching budget', { error: error.message, weekStart: req.params.weekStart, requestId: req.requestId, component: 'budget' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Set/update budget for a week
router.post('/budget', authenticateRequired, async (req, res) => {
    const { weekStart, budgetAmount, currency = 'EUR' } = req.body;

    if (!weekStart || budgetAmount === undefined) {
        return res.status(400).json({ error: 'weekStart and budgetAmount are required' });
    }

    try {
        const { rows } = await db.query(`
            INSERT INTO shopping_budget (week_start, budget_amount, currency)
            VALUES ($1, $2, $3)
            ON CONFLICT (week_start)
            DO UPDATE SET budget_amount = $2, currency = $3, updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [weekStart, budgetAmount, currency]);

        res.json(rows[0]);
    } catch (error) {
        logger.error('Error saving budget', { error: error.message, requestId: req.requestId, component: 'budget' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// ========== SUBSTITUTIONS ==========

// Get substitution preferences
router.get('/substitutions', authenticateRequired, async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM substitution_preferences WHERE is_active = true ORDER BY created_at DESC'
        );
        res.json(rows);
    } catch (error) {
        logger.error('Error fetching substitutions', { error: error.message, requestId: req.requestId, component: 'substitutions' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Save a substitution preference
router.post('/substitutions', authenticateRequired, async (req, res) => {
    const { originalIngredient, substituteIngredient, reason, savingsPercent } = req.body;

    if (!originalIngredient || !substituteIngredient) {
        return res.status(400).json({ error: 'originalIngredient and substituteIngredient are required' });
    }

    try {
        const { rows } = await db.query(`
            INSERT INTO substitution_preferences (original_ingredient, substitute_ingredient, reason, savings_percent)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (LOWER(original_ingredient), LOWER(substitute_ingredient))
            DO UPDATE SET reason = $3, savings_percent = $4, is_active = true
            RETURNING *
        `, [originalIngredient, substituteIngredient, reason, savingsPercent]);

        res.status(201).json(rows[0]);
    } catch (error) {
        logger.error('Error saving substitution', { error: error.message, requestId: req.requestId, component: 'substitutions' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Delete/deactivate a substitution preference
router.delete('/substitutions/:id', authenticateRequired, async (req, res) => {
    try {
        await db.query(
            'UPDATE substitution_preferences SET is_active = false WHERE id = $1',
            [req.params.id]
        );
        res.json({ message: 'Substitution preference deactivated' });
    } catch (error) {
        logger.error('Error deactivating substitution', { error: error.message, substitutionId: req.params.id, requestId: req.requestId, component: 'substitutions' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// ========== AI OPTIMIZATION ==========

// AI-powered shopping list optimization
router.post('/optimize', authenticateRequired, aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    try {
        const { shoppingList, budget, preferences } = req.body;

        if (!shoppingList || shoppingList.length === 0) {
            return res.status(400).json({ error: 'Shopping list is required' });
        }

        // Get saved substitution preferences
        const { rows: savedSubstitutions } = await db.query(
            'SELECT original_ingredient, substitute_ingredient, reason, savings_percent FROM substitution_preferences WHERE is_active = true'
        );

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Du bist ein intelligenter Einkaufsberater. Analysiere die folgende Einkaufsliste und schlage Optimierungen vor.

EINKAUFSLISTE:
${shoppingList.slice(0, 50).map(item => `- ${sanitizeForPrompt(item.amount, 20)} ${sanitizeForPrompt(item.unit, 20)} ${sanitizeForPrompt(item.name, 100)} (Kategorie: ${sanitizeForPrompt(item.category, 50)})`).join('\n')}

${budget ? `BUDGET: ${budget} EUR` : 'Kein spezifisches Budget angegeben.'}

${preferences?.prioritizeSeasonal ? 'PRÄFERENZ: Bevorzuge saisonale Produkte.' : ''}
${preferences?.prioritizeOrganic ? 'PRÄFERENZ: Bio-Produkte wenn möglich.' : ''}
${preferences?.avoidBrands ? 'PRÄFERENZ: Eigenmarken/No-Name bevorzugen.' : ''}

${savedSubstitutions.length > 0 ? `
BEVORZUGTE SUBSTITUTIONEN DES NUTZERS:
${savedSubstitutions.map(s => `- ${s.original_ingredient} -> ${s.substitute_ingredient} (${s.reason})`).join('\n')}
` : ''}

Erstelle Optimierungsvorschläge mit:
1. SUBSTITUTIONEN: Günstigere oder bessere Alternativen für teure Zutaten
2. SAISONALE TIPPS: Welche Produkte sind gerade saisonal/günstig
3. MENGEN-OPTIMIERUNG: Gibt es Großpackungen die sich lohnen? Vermeidung von Verschwendung
4. GESCHÄTZTE KOSTEN: Schätze die Gesamtkosten der Original-Liste und der optimierten Liste

WICHTIG: Antworte NUR mit einem validen JSON-Objekt im folgenden Format:

{
    "originalEstimate": 45.50,
    "optimizedEstimate": 38.20,
    "savingsPercent": 16,
    "substitutions": [
        {
            "original": "Parmesan",
            "substitute": "Grana Padano",
            "reason": "Ähnlicher Geschmack, 30% günstiger",
            "savingsPercent": 30,
            "category": "cost"
        }
    ],
    "seasonalTips": [
        {
            "ingredient": "Tomaten",
            "tip": "Aktuell Saison - besonders günstig und geschmackvoll",
            "isInSeason": true
        }
    ],
    "quantityTips": [
        {
            "ingredient": "Reis",
            "tip": "Großpackung (1kg statt 500g) spart 20% pro Kilo",
            "savingsPercent": 20
        }
    ],
    "generalTips": [
        "Tipp 1...",
        "Tipp 2..."
    ]
}`;

        const result = await model.generateContent(prompt);
        const optimization = extractJsonFromAiResponse(result.response.text());

        res.json(optimization);
    } catch (error) {
        logger.error('Shopping optimization error', { error: error.message, requestId: req.requestId, component: 'ai' });
        res.status(500).json({
            error: 'Failed to optimize shopping list'
        });
    }
});

module.exports = router;
