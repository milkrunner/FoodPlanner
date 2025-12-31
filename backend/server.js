const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const rateLimit = require('express-rate-limit');
const cheerio = require('cheerio');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// General API Rate Limiting
// Limit: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        error: 'Too many requests from this IP, please try again after 15 minutes.',
        retryAfter: '15 minutes'
    },
    // Skip rate limiting for local development
    skip: (req) => {
        return req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
    },
    handler: (req, res) => {
        console.log(`[RATE LIMIT] General API limit exceeded for IP: ${req.ip} on ${req.method} ${req.path}`);
        res.status(429).json({
            error: 'Too many requests from this IP, please try again after 15 minutes.',
            retryAfter: '15 minutes'
        });
    }
});

// AI Endpoints Rate Limiting (stricter)
// Limit: 20 AI requests per 15 minutes per IP
const aiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 AI requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many AI requests from this IP. AI endpoints are limited to 20 requests per 15 minutes.',
        retryAfter: '15 minutes'
    },
    skip: (req) => {
        return req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
    },
    handler: (req, res) => {
        console.log(`[RATE LIMIT] AI API limit exceeded for IP: ${req.ip} on ${req.method} ${req.path}`);
        res.status(429).json({
            error: 'Too many AI requests from this IP. AI endpoints are limited to 20 requests per 15 minutes.',
            retryAfter: '15 minutes'
        });
    }
});

// Apply general rate limiter to all API routes
app.use(generalLimiter);

// Note: AI rate limiter is applied directly to specific AI endpoints below
// AI endpoints have their own stricter rate limits (20 req/15min vs 100 req/15min for general API)
// Rate limiting headers included in responses:
//   - RateLimit-Limit: Maximum number of requests
//   - RateLimit-Remaining: Remaining requests
//   - RateLimit-Reset: Time when the limit resets (epoch seconds)

// Database connection check on startup
(async () => {
    const connected = await db.checkConnection();
    if (!connected) {
        console.error('Failed to connect to database. Exiting...');
        process.exit(1);
    }
})();

// ========== RECIPES ENDPOINTS ==========

// Get all recipes
app.get('/recipes', async (req, res) => {
    try {
        const { rows: recipes } = await db.query(`
            SELECT * FROM recipes ORDER BY created_at DESC
        `);

        // Get ingredients and tags for each recipe
        const recipesWithDetails = await Promise.all(recipes.map(async (recipe) => {
            const { rows: ingredients } = await db.query(
                'SELECT name, amount, unit, category FROM ingredients WHERE recipe_id = $1',
                [recipe.id]
            );

            const { rows: tagRows } = await db.query(
                'SELECT tag FROM recipe_tags WHERE recipe_id = $1',
                [recipe.id]
            );

            const tags = tagRows.map(row => row.tag);
            return { ...recipe, ingredients, tags };
        }));

        res.json(recipesWithDetails);
    } catch (error) {
        console.error('Error fetching recipes:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get recipe by ID
app.get('/recipes/:id', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM recipes WHERE id = $1',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        const recipe = rows[0];

        const { rows: ingredients } = await db.query(
            'SELECT name, amount, unit, category FROM ingredients WHERE recipe_id = $1',
            [recipe.id]
        );

        const { rows: tagRows } = await db.query(
            'SELECT tag FROM recipe_tags WHERE recipe_id = $1',
            [recipe.id]
        );

        const tags = tagRows.map(row => row.tag);
        res.json({ ...recipe, ingredients, tags });
    } catch (error) {
        console.error('Error fetching recipe:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create recipe
app.post('/recipes', async (req, res) => {
    const { id, name, category, servings, instructions, ingredients, tags } = req.body;

    try {
        await db.transaction(async (client) => {
            // Insert recipe
            await client.query(
                'INSERT INTO recipes (id, name, category, servings, instructions) VALUES ($1, $2, $3, $4, $5)',
                [id, name, category, servings, instructions]
            );

            // Insert ingredients
            if (ingredients && ingredients.length > 0) {
                for (const ing of ingredients) {
                    await client.query(
                        'INSERT INTO ingredients (recipe_id, name, amount, unit, category) VALUES ($1, $2, $3, $4, $5)',
                        [id, ing.name, ing.amount, ing.unit, ing.category || 'Sonstiges']
                    );
                }
            }

            // Insert tags
            if (tags && tags.length > 0) {
                for (const tag of tags) {
                    await client.query(
                        'INSERT INTO recipe_tags (recipe_id, tag) VALUES ($1, $2)',
                        [id, tag]
                    );
                }
            }
        });

        res.status(201).json({ id, message: 'Recipe created successfully' });
    } catch (error) {
        console.error('Error creating recipe:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update recipe
app.put('/recipes/:id', async (req, res) => {
    const { name, category, servings, instructions, ingredients, tags } = req.body;

    try {
        await db.transaction(async (client) => {
            // Update recipe
            await client.query(
                'UPDATE recipes SET name = $1, category = $2, servings = $3, instructions = $4 WHERE id = $5',
                [name, category, servings, instructions, req.params.id]
            );

            // Delete old ingredients and insert new ones
            await client.query('DELETE FROM ingredients WHERE recipe_id = $1', [req.params.id]);

            if (ingredients && ingredients.length > 0) {
                for (const ing of ingredients) {
                    await client.query(
                        'INSERT INTO ingredients (recipe_id, name, amount, unit, category) VALUES ($1, $2, $3, $4, $5)',
                        [req.params.id, ing.name, ing.amount, ing.unit, ing.category || 'Sonstiges']
                    );
                }
            }

            // Delete old tags and insert new ones
            await client.query('DELETE FROM recipe_tags WHERE recipe_id = $1', [req.params.id]);

            if (tags && tags.length > 0) {
                for (const tag of tags) {
                    await client.query(
                        'INSERT INTO recipe_tags (recipe_id, tag) VALUES ($1, $2)',
                        [req.params.id, tag]
                    );
                }
            }
        });

        res.json({ message: 'Recipe updated successfully' });
    } catch (error) {
        console.error('Error updating recipe:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete recipe
app.delete('/recipes/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM recipes WHERE id = $1', [req.params.id]);
        res.json({ message: 'Recipe deleted successfully' });
    } catch (error) {
        console.error('Error deleting recipe:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== WEEK PLAN ENDPOINTS ==========

// Get current week plan
app.get('/weekplan', async (req, res) => {
    try {
        const { rows: weekPlans } = await db.query(
            'SELECT * FROM week_plans ORDER BY created_at DESC LIMIT 1'
        );

        if (weekPlans.length === 0) {
            return res.json(null);
        }

        const weekPlan = weekPlans[0];

        const { rows: days } = await db.query(
            'SELECT * FROM days WHERE week_plan_id = $1 ORDER BY id',
            [weekPlan.id]
        );

        const daysWithMeals = await Promise.all(days.map(async (day) => {
            const { rows: meals } = await db.query(
                'SELECT * FROM meals WHERE day_id = $1',
                [day.id]
            );

            const mealsObj = {};
            meals.forEach(meal => {
                mealsObj[meal.meal_type] = {
                    id: meal.id,
                    recipeId: meal.recipe_id,
                    recipeName: meal.recipe_name,
                    mealType: meal.meal_type
                };
            });

            return { ...day, meals: mealsObj };
        }));

        res.json({
            id: weekPlan.id,
            startDate: weekPlan.start_date,
            days: daysWithMeals.map(d => ({
                date: d.date,
                dayName: d.day_name,
                meals: d.meals
            }))
        });
    } catch (error) {
        console.error('Error fetching week plan:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save week plan (supports multiple weeks)
app.post('/weekplan', async (req, res) => {
    const { id, startDate, days } = req.body;

    try {
        await db.transaction(async (client) => {
            // Delete existing week plan with the same ID
            await client.query('DELETE FROM week_plans WHERE id = $1', [id]);

            // Insert new week plan
            await client.query(
                'INSERT INTO week_plans (id, start_date) VALUES ($1, $2)',
                [id, startDate]
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
        console.error('Error saving week plan:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete week plan
app.delete('/weekplan', async (req, res) => {
    try {
        await db.query('DELETE FROM week_plans');
        res.json({ message: 'Week plan deleted successfully' });
    } catch (error) {
        console.error('Error deleting week plan:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get week plan by date (finds week containing the given date)
app.get('/weekplan/by-date/:date', async (req, res) => {
    try {
        const requestedDate = new Date(req.params.date);

        // Calculate Monday of the requested week
        const day = requestedDate.getDay();
        const diff = requestedDate.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(requestedDate);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);

        // Format as YYYY-MM-DD for comparison
        const mondayStr = monday.toISOString().split('T')[0];

        const { rows: weekPlans } = await db.query(
            'SELECT * FROM week_plans WHERE start_date::date = $1::date',
            [mondayStr]
        );

        if (weekPlans.length === 0) {
            return res.status(404).json({ error: 'Week plan not found' });
        }

        const weekPlan = weekPlans[0];

        const { rows: days } = await db.query(
            'SELECT * FROM days WHERE week_plan_id = $1 ORDER BY id',
            [weekPlan.id]
        );

        const daysWithMeals = await Promise.all(days.map(async (day) => {
            const { rows: meals } = await db.query(
                'SELECT * FROM meals WHERE day_id = $1',
                [day.id]
            );

            const mealsObj = {};
            meals.forEach(meal => {
                mealsObj[meal.meal_type] = {
                    id: meal.id,
                    recipeId: meal.recipe_id,
                    recipeName: meal.recipe_name,
                    mealType: meal.meal_type
                };
            });

            return { ...day, meals: mealsObj };
        }));

        res.json({
            id: weekPlan.id,
            startDate: weekPlan.start_date,
            days: daysWithMeals.map(d => ({
                date: d.date,
                dayName: d.day_name,
                meals: d.meals
            }))
        });
    } catch (error) {
        console.error('Error fetching week plan by date:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== WEEK PLAN TEMPLATES ENDPOINTS ==========

// Get all templates
app.get('/weekplan/templates', async (req, res) => {
    try {
        const { rows: templates } = await db.query(
            'SELECT * FROM week_plan_templates ORDER BY created_at DESC'
        );

        const parsedTemplates = templates.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
            templateData: t.template_data, // JSONB is automatically parsed
            createdAt: t.created_at,
            updatedAt: t.updated_at
        }));

        res.json(parsedTemplates);
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get template by ID
app.get('/weekplan/templates/:id', async (req, res) => {
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
        console.error('Error fetching template:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save template
app.post('/weekplan/templates', async (req, res) => {
    const { id, name, description, templateData } = req.body;

    if (!name || !templateData) {
        return res.status(400).json({ error: 'Name and template data are required' });
    }

    try {
        await db.query(
            'INSERT INTO week_plan_templates (id, name, description, template_data) VALUES ($1, $2, $3, $4)',
            [id, name, description || '', templateData] // JSONB handles objects directly
        );

        res.status(201).json({
            message: 'Template saved successfully',
            id: id
        });
    } catch (error) {
        console.error('Error saving template:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update template
app.put('/weekplan/templates/:id', async (req, res) => {
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
        console.error('Error updating template:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete template
app.delete('/weekplan/templates/:id', async (req, res) => {
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
        console.error('Error deleting template:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== MANUAL SHOPPING ITEMS ENDPOINTS ==========

// Get all manual shopping items
app.get('/shopping/manual', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM manual_shopping_items ORDER BY created_at DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching manual shopping items:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add manual shopping item
app.post('/shopping/manual', async (req, res) => {
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
        console.error('Error adding manual shopping item:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete manual shopping item
app.delete('/shopping/manual/:id', async (req, res) => {
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
        console.error('Error deleting manual shopping item:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete all manual shopping items
app.delete('/shopping/manual', async (req, res) => {
    try {
        await db.query('DELETE FROM manual_shopping_items');
        res.json({ message: 'All manual shopping items deleted successfully' });
    } catch (error) {
        console.error('Error deleting all manual shopping items:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== SHOPPING BUDGET ENDPOINTS ==========

// Get budget for a specific week
app.get('/shopping/budget/:weekStart', async (req, res) => {
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
        console.error('Error fetching budget:', error);
        res.status(500).json({ error: error.message });
    }
});

// Set/update budget for a week
app.post('/shopping/budget', async (req, res) => {
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
        console.error('Error saving budget:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get substitution preferences
app.get('/shopping/substitutions', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM substitution_preferences WHERE is_active = true ORDER BY created_at DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching substitutions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save a substitution preference
app.post('/shopping/substitutions', async (req, res) => {
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
        console.error('Error saving substitution:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete/deactivate a substitution preference
app.delete('/shopping/substitutions/:id', async (req, res) => {
    try {
        await db.query(
            'UPDATE substitution_preferences SET is_active = false WHERE id = $1',
            [req.params.id]
        );
        res.json({ message: 'Substitution preference deactivated' });
    } catch (error) {
        console.error('Error deactivating substitution:', error);
        res.status(500).json({ error: error.message });
    }
});

// AI-powered shopping list optimization
app.post('/shopping/optimize', aiLimiter, async (req, res) => {
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
${shoppingList.map(item => `- ${item.amount} ${item.unit} ${item.name} (Kategorie: ${item.category})`).join('\n')}

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
        const response = result.response;
        const text = response.text();

        // Extract JSON from response
        let jsonText = text.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
        }

        const optimization = JSON.parse(jsonText);

        res.json(optimization);
    } catch (error) {
        console.error('Shopping optimization error:', error);
        res.status(500).json({
            error: 'Failed to optimize shopping list',
            details: error.message
        });
    }
});

// Health check
app.get('/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'OK', database: 'connected', timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(503).json({ status: 'ERROR', database: 'disconnected', timestamp: new Date().toISOString() });
    }
});

// ========== COOKING HISTORY ENDPOINTS ==========

// Get cooking history (paginated)
app.get('/cooking-history', async (req, res) => {
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
        console.error('Error fetching cooking history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get cooking stats for all recipes
app.get('/cooking-history/stats', async (req, res) => {
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
        console.error('Error fetching cooking stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get cooking history for a specific recipe
app.get('/cooking-history/recipe/:recipeId', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT id, recipe_id, cooked_at, servings, notes
            FROM cooking_history
            WHERE recipe_id = $1
            ORDER BY cooked_at DESC
        `, [req.params.recipeId]);

        res.json(rows);
    } catch (error) {
        console.error('Error fetching recipe cooking history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Mark recipe as cooked
app.post('/cooking-history', async (req, res) => {
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
        console.error('Error marking recipe as cooked:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete cooking history entry
app.delete('/cooking-history/:id', async (req, res) => {
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
        console.error('Error deleting cooking history entry:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get recipes that haven't been cooked recently
app.get('/cooking-history/not-cooked-recently', async (req, res) => {
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
        console.error('Error fetching not recently cooked recipes:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== AI ENDPOINTS ==========

// Generate recipes from ingredients
app.post('/ai/generate-recipes', aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    try {
        const { ingredients, preferences } = req.body;

        if (!ingredients || ingredients.length === 0) {
            return res.status(400).json({ error: 'Please provide at least one ingredient' });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Du bist ein kreativer Koch-Assistent. Generiere 3 leckere Rezept-Vorschläge basierend auf folgenden Zutaten:

Verfügbare Zutaten: ${ingredients.join(', ')}

${preferences?.dietary ? `Ernährungspräferenzen: ${preferences.dietary}` : ''}
${preferences?.cookingTime ? `Maximale Kochzeit: ${preferences.cookingTime} Minuten` : ''}
${preferences?.difficulty ? `Schwierigkeitsgrad: ${preferences.difficulty}` : ''}

Erstelle für jedes Rezept:
- Einen kreativen Namen
- Kategorie (z.B. Hauptgericht, Suppe, Salat, etc.)
- Anzahl Portionen
- Liste der Zutaten mit Mengen und Einheiten und Kategorien (Obst & Gemüse, Milchprodukte, Fleisch & Fisch, Trockenwaren, Tiefkühl, Sonstiges)
- Schritt-für-Schritt Anleitung

WICHTIG: Antworte NUR mit einem validen JSON-Array im folgenden Format, ohne zusätzlichen Text:

[
  {
    "name": "Rezeptname",
    "category": "Kategorie",
    "servings": 4,
    "ingredients": [
      {
        "name": "Zutat",
        "amount": "200",
        "unit": "g",
        "category": "Obst & Gemüse"
      }
    ],
    "instructions": "Schritt 1: ... Schritt 2: ..."
  }
]`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Extract JSON from response (remove markdown code blocks if present)
        let jsonText = text.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
        }

        const recipes = JSON.parse(jsonText);

        res.json({ recipes });
    } catch (error) {
        console.error('AI generation error:', error);
        res.status(500).json({
            error: 'Failed to generate recipes',
            details: error.message
        });
    }
});

// AI-based ingredient categorization
app.post('/ai/categorize-ingredient', async (req, res) => {
    try {
        const { ingredientName } = req.body;

        if (!ingredientName) {
            return res.status(400).json({ error: 'Missing required field: ingredientName' });
        }

        const categories = ['Obst & Gemüse', 'Milchprodukte', 'Fleisch & Fisch', 'Trockenwaren', 'Tiefkühl', 'Sonstiges'];

        // Rule-based fallback categorization (fast, works offline)
        const ruleBased = categorizeIngredientRuleBased(ingredientName.toLowerCase());

        // If Gemini is not available, use rule-based only
        if (!genAI) {
            return res.json({ category: ruleBased, source: 'rule-based' });
        }

        // Try AI categorization
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            const prompt = `Kategorisiere die folgende Zutat in genau eine der folgenden Kategorien:

Kategorien:
- Obst & Gemüse
- Milchprodukte
- Fleisch & Fisch
- Trockenwaren
- Tiefkühl
- Sonstiges

Zutat: "${ingredientName}"

WICHTIG: Antworte NUR mit dem Namen der Kategorie, ohne zusätzlichen Text oder Erklärungen.`;

            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text().trim();

            // Validate that response is one of the valid categories
            if (categories.includes(text)) {
                return res.json({ category: text, source: 'ai' });
            } else {
                // AI returned invalid category, use rule-based
                return res.json({ category: ruleBased, source: 'rule-based-fallback' });
            }
        } catch (aiError) {
            console.error('AI categorization error:', aiError);
            // AI failed, use rule-based
            return res.json({ category: ruleBased, source: 'rule-based-fallback' });
        }
    } catch (error) {
        console.error('Categorization error:', error);
        res.status(500).json({
            error: 'Failed to categorize ingredient',
            details: error.message
        });
    }
});

// Rule-based ingredient categorization function
function categorizeIngredientRuleBased(ingredient) {
    const lowerIngredient = ingredient.toLowerCase();

    // Obst & Gemüse
    const fruitsVeggies = [
        'apfel', 'birne', 'banane', 'orange', 'zitrone', 'erdbeere', 'himbeere', 'blaubeere', 'traube', 'melone',
        'tomate', 'gurke', 'paprika', 'zwiebel', 'knoblauch', 'kartoffel', 'karotte', 'möhre', 'salat', 'spinat',
        'brokkoli', 'blumenkohl', 'kohl', 'zucchini', 'aubergine', 'kürbis', 'sellerie', 'lauch', 'radieschen',
        'pilz', 'champignon', 'petersilie', 'basilikum', 'thymian', 'rosmarin', 'koriander', 'schnittlauch',
        'avocado', 'mango', 'ananas', 'kiwi', 'pfirsich', 'pflaume', 'kirsche', 'gemüse', 'obst', 'salat'
    ];

    // Milchprodukte
    const dairy = [
        'milch', 'sahne', 'butter', 'käse', 'joghurt', 'quark', 'schmand', 'crème', 'mascarpone',
        'mozzarella', 'parmesan', 'gouda', 'feta', 'ricotta', 'frischkäse', 'schlagsahne'
    ];

    // Fleisch & Fisch
    const meatFish = [
        'fleisch', 'huhn', 'hähnchen', 'pute', 'rind', 'schwein', 'lamm', 'hack', 'wurst', 'schinken',
        'speck', 'fisch', 'lachs', 'thunfisch', 'forelle', 'kabeljau', 'garnele', 'shrimp', 'muschel',
        'steak', 'schnitzel', 'filet', 'bacon', 'salami'
    ];

    // Trockenwaren
    const dryGoods = [
        'mehl', 'zucker', 'salz', 'pfeffer', 'reis', 'nudel', 'pasta', 'spaghetti', 'linsen', 'bohnen',
        'kichererbsen', 'hafer', 'müsli', 'cornflakes', 'honig', 'marmelade', 'öl', 'essig', 'gewürz',
        'backpulver', 'hefe', 'vanille', 'zimt', 'kakao', 'schokolade', 'nuss', 'mandel', 'walnuss',
        'haselnuss', 'rosine', 'dattel', 'couscous', 'quinoa', 'bulgur', 'kaffee', 'tee'
    ];

    // Tiefkühl
    const frozen = [
        'tiefkühl', 'gefroren', 'tk-', 'erbsen', 'mais', 'eis', 'eiscreme'
    ];

    // Check each category
    for (const fruit of fruitsVeggies) {
        if (lowerIngredient.includes(fruit)) return 'Obst & Gemüse';
    }

    for (const d of dairy) {
        if (lowerIngredient.includes(d)) return 'Milchprodukte';
    }

    for (const m of meatFish) {
        if (lowerIngredient.includes(m)) return 'Fleisch & Fisch';
    }

    for (const f of frozen) {
        if (lowerIngredient.includes(f)) return 'Tiefkühl';
    }

    for (const dry of dryGoods) {
        if (lowerIngredient.includes(dry)) return 'Trockenwaren';
    }

    // Default to Sonstiges
    return 'Sonstiges';
}

// AI-based portion scaling
app.post('/ai/scale-portions', aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    try {
        const { ingredients, originalServings, newServings } = req.body;

        if (!ingredients || !originalServings || !newServings) {
            return res.status(400).json({ error: 'Missing required fields: ingredients, originalServings, newServings' });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Du bist ein Küchen-Assistent, der bei der Skalierung von Rezepten hilft.

Aufgabe: Skaliere die folgenden Zutaten von ${originalServings} Portionen auf ${newServings} Portionen. Verwende dabei intelligente Rundung für praktische Mengen.

Regeln für intelligente Rundung:
- Runde auf handelsübliche Mengen (z.B. 247g → 250g, 123g → 125g)
- Bei Eiern: Runde auf ganze Zahlen (z.B. 0.8 Eier → 1 Ei, 2.3 Eier → 2 Eier)
- Bei Esslöffeln/Teelöffeln: Runde auf halbe oder ganze Werte (z.B. 3.2 EL → 3 EL, 1.7 TL → 1.5 TL)
- Optimiere Einheiten wo sinnvoll (z.B. 1200ml → 1.2L, 1500g → 1.5kg)
- Behalte die Kategorie der Zutat bei

Originale Zutaten:
${JSON.stringify(ingredients, null, 2)}

WICHTIG: Antworte NUR mit einem validen JSON-Array im folgenden Format, ohne zusätzlichen Text:

[
  {
    "name": "Zutatname",
    "amount": "250",
    "unit": "g",
    "category": "Kategorie"
  }
]`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Extract JSON from response (remove markdown code blocks if present)
        let jsonText = text.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
        }

        const scaledIngredients = JSON.parse(jsonText);

        res.json({ ingredients: scaledIngredients });
    } catch (error) {
        console.error('AI portion scaling error:', error);
        res.status(500).json({
            error: 'Failed to scale portions',
            details: error.message
        });
    }
});

// Allowlist of trusted recipe domains to prevent SSRF attacks
const ALLOWED_RECIPE_DOMAINS = [
    'chefkoch.de',
    'www.chefkoch.de',
    'eatsmarter.de',
    'www.eatsmarter.de',
    'lecker.de',
    'www.lecker.de',
    'gutekueche.at',
    'www.gutekueche.at',
    'kochbar.de',
    'www.kochbar.de',
    'rezeptwelt.de',
    'www.rezeptwelt.de',
    'kitchenstories.com',
    'www.kitchenstories.com',
    'allrecipes.com',
    'www.allrecipes.com',
    'bbcgoodfood.com',
    'www.bbcgoodfood.com',
    'seriouseats.com',
    'www.seriouseats.com',
    'food.com',
    'www.food.com',
    'epicurious.com',
    'www.epicurious.com',
    'bonappetit.com',
    'www.bonappetit.com',
    'delish.com',
    'www.delish.com',
    'tasty.co',
    'www.tasty.co',
    'simplyrecipes.com',
    'www.simplyrecipes.com',
    'foodnetwork.com',
    'www.foodnetwork.com'
];

// URL validation to prevent SSRF attacks - only allows trusted recipe domains
function validateUrl(urlString) {
    let url;
    try {
        url = new URL(urlString);
    } catch {
        throw new Error('Invalid URL format');
    }

    // Only allow http and https protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Only HTTP and HTTPS protocols are allowed');
    }

    // Check against allowlist of trusted domains
    const hostname = url.hostname.toLowerCase();
    if (!ALLOWED_RECIPE_DOMAINS.includes(hostname)) {
        throw new Error(
            `Domain "${hostname}" is not in the list of allowed recipe websites. ` +
            `Allowed domains: ${ALLOWED_RECIPE_DOMAINS.filter(d => !d.startsWith('www.')).join(', ')}`
        );
    }

    return url.href;
}

// Helper function to fetch and extract text from URL
async function fetchRecipeFromUrl(userProvidedUrl) {
    // Validate URL against allowlist - throws error if domain not allowed
    const safeUrl = validateUrl(userProvidedUrl);

    // Build a new URL from validated components to ensure safety
    const urlObj = new URL(safeUrl);
    const fetchUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}${urlObj.search}`;

    try {
        const response = await fetch(fetchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            redirect: 'manual'
        });

        // Handle redirects safely - only follow if redirect stays on allowed domains
        if (response.status >= 300 && response.status < 400) {
            const redirectLocation = response.headers.get('location');
            if (redirectLocation) {
                const redirectUrl = new URL(redirectLocation, fetchUrl);
                // Validate redirect URL against allowlist
                const safeRedirectUrl = validateUrl(redirectUrl.href);
                const redirectUrlObj = new URL(safeRedirectUrl);
                const fetchRedirectUrl = `${redirectUrlObj.protocol}//${redirectUrlObj.host}${redirectUrlObj.pathname}${redirectUrlObj.search}`;

                const redirectResponse = await fetch(fetchRedirectUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    },
                    redirect: 'manual'
                });
                if (!redirectResponse.ok) {
                    throw new Error(`HTTP error! status: ${redirectResponse.status}`);
                }
                const html = await redirectResponse.text();
                return extractRecipeText(html);
            }
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        return extractRecipeText(html);
    } catch (error) {
        throw new Error(`Failed to fetch URL: ${error.message}`);
    }
}

// Helper function to extract recipe text from HTML
function extractRecipeText(html) {
    const $ = cheerio.load(html);

    // Remove script and style elements
    $('script, style, nav, header, footer, iframe, noscript').remove();

    // Try to find recipe-specific content
    let recipeText = '';

    // Look for common recipe containers
    const recipeSelectors = [
        '[itemtype*="Recipe"]',
        '.recipe',
        '#recipe',
        '.recipe-content',
        '.recipe-instructions',
        'article',
        'main'
    ];

    for (const selector of recipeSelectors) {
        const element = $(selector);
        if (element.length > 0) {
            recipeText = element.text();
            break;
        }
    }

    // Fallback to body content if no recipe-specific content found
    if (!recipeText) {
        recipeText = $('body').text();
    }

    // Clean up whitespace
    recipeText = recipeText
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

    return recipeText;
}

// Recipe Parser - Parse free text into structured recipe
app.post('/ai/parse-recipe', aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    try {
        let { input, type } = req.body;

        if (!input || !input.trim()) {
            return res.status(400).json({
                error: 'Input text is required'
            });
        }

        // Auto-detect if input is a URL
        if (!type && (input.trim().startsWith('http://') || input.trim().startsWith('https://'))) {
            type = 'url';
        }

        // Fetch content from URL if needed
        if (type === 'url') {
            const url = input.trim();
            console.log(`Fetching recipe from URL: ${url}`);

            try {
                input = await fetchRecipeFromUrl(url);
                console.log(`Fetched ${input.length} characters from URL`);
            } catch (fetchError) {
                return res.status(400).json({
                    error: 'Failed to fetch recipe from URL',
                    details: fetchError.message,
                    hint: 'Make sure the URL is accessible and contains a recipe.'
                });
            }
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Du bist ein intelligenter Rezept-Parser. Analysiere den folgenden Text und extrahiere ein strukturiertes Rezept daraus.

Text:
${input}

WICHTIG: Antworte NUR mit einem validen JSON-Objekt im folgenden Format (ohne Markdown-Formatierung):

{
  "name": "Rezeptname",
  "category": "Kategorie (z.B. Hauptgericht, Suppe, Salat, Dessert, Vorspeise, Beilage, etc.)",
  "servings": 4,
  "ingredients": [
    {
      "name": "Zutat",
      "amount": "200",
      "unit": "g",
      "category": "Obst & Gemüse"
    }
  ],
  "instructions": "Schritt 1: ... Schritt 2: ..."
}

Regeln:
- Extrahiere den Rezeptnamen so genau wie möglich
- Identifiziere alle Zutaten mit Mengen und Einheiten
- Kategorisiere jede Zutat in eine der Kategorien: "Obst & Gemüse", "Milchprodukte", "Fleisch & Fisch", "Trockenwaren", "Tiefkühl", "Sonstiges"
- Fasse die Zubereitungsschritte in einer klaren Anleitung zusammen
- Erkenne die Portionsanzahl (Standard: 4)
- Bestimme eine passende Kategorie für das Rezept
- Wenn Mengenangaben fehlen, verwende sinnvolle Standardwerte
- Antworte AUSSCHLIESSLICH mit dem JSON-Objekt, keine zusätzlichen Erklärungen`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        let jsonText = response.text().trim();

        console.log('AI Response:', jsonText);

        // Remove markdown code blocks if present
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?$/g, '').trim();
        }

        // Parse the JSON
        let recipe;
        try {
            recipe = JSON.parse(jsonText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            return res.status(500).json({
                error: 'Failed to parse AI response as JSON',
                details: parseError.message,
                rawResponse: jsonText
            });
        }

        // Validate required fields
        if (!recipe.name || !recipe.ingredients || recipe.ingredients.length === 0) {
            return res.status(400).json({
                error: 'Parsed recipe is incomplete. Missing name or ingredients.',
                parsedData: recipe
            });
        }

        // Ensure all required fields have defaults
        recipe.id = Date.now().toString();
        recipe.category = recipe.category || 'Hauptgericht';
        recipe.servings = recipe.servings || 4;
        recipe.instructions = recipe.instructions || '';

        // Validate ingredients
        recipe.ingredients = recipe.ingredients.map(ing => ({
            name: ing.name || '',
            amount: ing.amount || '1',
            unit: ing.unit || 'x',
            category: ing.category || 'Sonstiges'
        }));

        res.json({
            recipe,
            source: 'ai-parsed'
        });
    } catch (error) {
        console.error('Recipe parsing error:', error);
        res.status(500).json({
            error: 'Failed to parse recipe',
            details: error.message
        });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Food Planner Backend running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing database...');
    await db.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, closing database...');
    await db.close();
    process.exit(0);
});
