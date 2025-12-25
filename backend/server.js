const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const rateLimit = require('express-rate-limit');
const cheerio = require('cheerio');

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
app.use('/api/', generalLimiter);

// Note: AI rate limiter is applied directly to specific AI endpoints below
// AI endpoints have their own stricter rate limits (20 req/15min vs 100 req/15min for general API)
// Rate limiting headers included in responses:
//   - RateLimit-Limit: Maximum number of requests
//   - RateLimit-Remaining: Remaining requests
//   - RateLimit-Reset: Time when the limit resets (epoch seconds)

// Database setup
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'foodplanner.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
        initDatabase();
    }
});

// Initialize database tables
function initDatabase() {
    db.serialize(() => {
        // Recipes table
        db.run(`
            CREATE TABLE IF NOT EXISTS recipes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT,
                servings INTEGER,
                instructions TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Ingredients table
        db.run(`
            CREATE TABLE IF NOT EXISTS ingredients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipe_id TEXT NOT NULL,
                name TEXT NOT NULL,
                amount TEXT NOT NULL,
                unit TEXT NOT NULL,
                category TEXT DEFAULT 'Sonstiges',
                FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
            )
        `);

        // Week plans table
        db.run(`
            CREATE TABLE IF NOT EXISTS week_plans (
                id TEXT PRIMARY KEY,
                start_date TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Days table
        db.run(`
            CREATE TABLE IF NOT EXISTS days (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                week_plan_id TEXT NOT NULL,
                date TEXT NOT NULL,
                day_name TEXT NOT NULL,
                FOREIGN KEY (week_plan_id) REFERENCES week_plans(id) ON DELETE CASCADE
            )
        `);

        // Add category column to existing ingredients tables (migration)
        db.run(`
            ALTER TABLE ingredients ADD COLUMN category TEXT DEFAULT 'Sonstiges'
        `, (err) => {
            // Ignore error if column already exists
            if (err && !err.message.includes('duplicate column')) {
                console.error('Migration warning:', err.message);
            }
        });

        // Meals table
        db.run(`
            CREATE TABLE IF NOT EXISTS meals (
                id TEXT PRIMARY KEY,
                day_id INTEGER NOT NULL,
                recipe_id TEXT,
                recipe_name TEXT NOT NULL,
                meal_type TEXT NOT NULL,
                FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE,
                FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
            )
        `);

        // Week plan templates table
        db.run(`
            CREATE TABLE IF NOT EXISTS week_plan_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                template_data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Manual shopping items table
        db.run(`
            CREATE TABLE IF NOT EXISTS manual_shopping_items (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                amount TEXT NOT NULL,
                unit TEXT NOT NULL,
                category TEXT DEFAULT 'Sonstiges',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Recipe tags table
        db.run(`
            CREATE TABLE IF NOT EXISTS recipe_tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recipe_id TEXT NOT NULL,
                tag TEXT NOT NULL,
                FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
            )
        `);

        console.log('Database tables initialized');
    });
}

// ========== RECIPES ENDPOINTS ==========

// Get all recipes
app.get('/recipes', (req, res) => {
    db.all('SELECT * FROM recipes ORDER BY created_at DESC', [], (err, recipes) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Get ingredients and tags for each recipe
        const promises = recipes.map(recipe => {
            return new Promise((resolve, reject) => {
                // Get ingredients
                db.all(
                    'SELECT name, amount, unit, category FROM ingredients WHERE recipe_id = ?',
                    [recipe.id],
                    (err, ingredients) => {
                        if (err) {
                            reject(err);
                        } else {
                            // Get tags
                            db.all(
                                'SELECT tag FROM recipe_tags WHERE recipe_id = ?',
                                [recipe.id],
                                (err, tagRows) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        const tags = tagRows.map(row => row.tag);
                                        resolve({ ...recipe, ingredients, tags });
                                    }
                                }
                            );
                        }
                    }
                );
            });
        });

        Promise.all(promises)
            .then(results => res.json(results))
            .catch(err => res.status(500).json({ error: err.message }));
    });
});

// Get recipe by ID
app.get('/recipes/:id', (req, res) => {
    db.get('SELECT * FROM recipes WHERE id = ?', [req.params.id], (err, recipe) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        // Get ingredients
        db.all(
            'SELECT name, amount, unit, category FROM ingredients WHERE recipe_id = ?',
            [recipe.id],
            (err, ingredients) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                // Get tags
                db.all(
                    'SELECT tag FROM recipe_tags WHERE recipe_id = ?',
                    [recipe.id],
                    (err, tagRows) => {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }
                        const tags = tagRows.map(row => row.tag);
                        res.json({ ...recipe, ingredients, tags });
                    }
                );
            }
        );
    });
});

// Create recipe
app.post('/recipes', (req, res) => {
    const { id, name, category, servings, instructions, ingredients, tags } = req.body;

    db.run(
        'INSERT INTO recipes (id, name, category, servings, instructions) VALUES (?, ?, ?, ?, ?)',
        [id, name, category, servings, instructions],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Insert ingredients
            if (ingredients && ingredients.length > 0) {
                const stmt = db.prepare('INSERT INTO ingredients (recipe_id, name, amount, unit, category) VALUES (?, ?, ?, ?, ?)');
                ingredients.forEach(ing => {
                    stmt.run(id, ing.name, ing.amount, ing.unit, ing.category || 'Sonstiges');
                });
                stmt.finalize();
            }

            // Insert tags
            if (tags && tags.length > 0) {
                const stmt = db.prepare('INSERT INTO recipe_tags (recipe_id, tag) VALUES (?, ?)');
                tags.forEach(tag => {
                    stmt.run(id, tag);
                });
                stmt.finalize();
            }

            res.status(201).json({ id, message: 'Recipe created successfully' });
        }
    );
});

// Update recipe
app.put('/recipes/:id', (req, res) => {
    const { name, category, servings, instructions, ingredients, tags } = req.body;

    db.run(
        'UPDATE recipes SET name = ?, category = ?, servings = ?, instructions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, category, servings, instructions, req.params.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Delete old ingredients
            db.run('DELETE FROM ingredients WHERE recipe_id = ?', [req.params.id], (err) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                // Insert new ingredients
                if (ingredients && ingredients.length > 0) {
                    const stmt = db.prepare('INSERT INTO ingredients (recipe_id, name, amount, unit, category) VALUES (?, ?, ?, ?, ?)');
                    ingredients.forEach(ing => {
                        stmt.run(req.params.id, ing.name, ing.amount, ing.unit, ing.category || 'Sonstiges');
                    });
                    stmt.finalize();
                }

                // Delete old tags
                db.run('DELETE FROM recipe_tags WHERE recipe_id = ?', [req.params.id], (err) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }

                    // Insert new tags
                    if (tags && tags.length > 0) {
                        const stmt = db.prepare('INSERT INTO recipe_tags (recipe_id, tag) VALUES (?, ?)');
                        tags.forEach(tag => {
                            stmt.run(req.params.id, tag);
                        });
                        stmt.finalize();
                    }

                    res.json({ message: 'Recipe updated successfully' });
                });
            });
        }
    );
});

// Delete recipe
app.delete('/recipes/:id', (req, res) => {
    db.run('DELETE FROM recipes WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Recipe deleted successfully' });
    });
});

// ========== WEEK PLAN ENDPOINTS ==========

// Get current week plan
app.get('/weekplan', (req, res) => {
    db.get('SELECT * FROM week_plans ORDER BY created_at DESC LIMIT 1', [], (err, weekPlan) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!weekPlan) {
            return res.json(null);
        }

        // Get days for this week plan
        db.all('SELECT * FROM days WHERE week_plan_id = ? ORDER BY id', [weekPlan.id], (err, days) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Get meals for each day
            const promises = days.map(day => {
                return new Promise((resolve, reject) => {
                    db.all(
                        'SELECT * FROM meals WHERE day_id = ?',
                        [day.id],
                        (err, meals) => {
                            if (err) reject(err);
                            else {
                                const mealsObj = {};
                                meals.forEach(meal => {
                                    mealsObj[meal.meal_type] = {
                                        id: meal.id,
                                        recipeId: meal.recipe_id,
                                        recipeName: meal.recipe_name,
                                        mealType: meal.meal_type
                                    };
                                });
                                resolve({ ...day, meals: mealsObj });
                            }
                        }
                    );
                });
            });

            Promise.all(promises)
                .then(daysWithMeals => {
                    res.json({
                        id: weekPlan.id,
                        startDate: weekPlan.start_date,
                        days: daysWithMeals.map(d => ({
                            date: d.date,
                            dayName: d.day_name,
                            meals: d.meals
                        }))
                    });
                })
                .catch(err => res.status(500).json({ error: err.message }));
        });
    });
});

// Save week plan
app.post('/weekplan', (req, res) => {
    const { id, startDate, days } = req.body;

    // Delete existing week plan
    db.run('DELETE FROM week_plans', [], (err) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Insert new week plan
        db.run(
            'INSERT INTO week_plans (id, start_date) VALUES (?, ?)',
            [id, startDate],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                // Insert days
                const dayStmt = db.prepare('INSERT INTO days (week_plan_id, date, day_name) VALUES (?, ?, ?)');
                const mealStmt = db.prepare('INSERT INTO meals (id, day_id, recipe_id, recipe_name, meal_type) VALUES (?, ?, ?, ?, ?)');

                db.serialize(() => {
                    days.forEach(day => {
                        dayStmt.run(id, day.date, day.dayName, function(err) {
                            if (!err) {
                                const dayId = this.lastID;
                                Object.entries(day.meals || {}).forEach(([mealType, meal]) => {
                                    mealStmt.run(meal.id, dayId, meal.recipeId, meal.recipeName, mealType);
                                });
                            }
                        });
                    });

                    dayStmt.finalize();
                    mealStmt.finalize();
                });

                res.status(201).json({ message: 'Week plan saved successfully' });
            }
        );
    });
});

// Delete week plan
app.delete('/weekplan', (req, res) => {
    db.run('DELETE FROM week_plans', [], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Week plan deleted successfully' });
    });
});

// ========== WEEK PLAN TEMPLATES ENDPOINTS ==========

// Get all templates
app.get('/weekplan/templates', (req, res) => {
    db.all('SELECT * FROM week_plan_templates ORDER BY created_at DESC', [], (err, templates) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Parse template_data JSON for each template
        const parsedTemplates = templates.map(t => ({
            id: t.id,
            name: t.name,
            description: t.description,
            templateData: JSON.parse(t.template_data),
            createdAt: t.created_at,
            updatedAt: t.updated_at
        }));

        res.json(parsedTemplates);
    });
});

// Get template by ID
app.get('/weekplan/templates/:id', (req, res) => {
    db.get('SELECT * FROM week_plan_templates WHERE id = ?', [req.params.id], (err, template) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        res.json({
            id: template.id,
            name: template.name,
            description: template.description,
            templateData: JSON.parse(template.template_data),
            createdAt: template.created_at,
            updatedAt: template.updated_at
        });
    });
});

// Save template
app.post('/weekplan/templates', (req, res) => {
    const { id, name, description, templateData } = req.body;

    if (!name || !templateData) {
        return res.status(400).json({ error: 'Name and template data are required' });
    }

    const templateDataJson = JSON.stringify(templateData);

    db.run(
        'INSERT INTO week_plan_templates (id, name, description, template_data) VALUES (?, ?, ?, ?)',
        [id, name, description || '', templateDataJson],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({
                message: 'Template saved successfully',
                id: id
            });
        }
    );
});

// Update template
app.put('/weekplan/templates/:id', (req, res) => {
    const { name, description, templateData } = req.body;

    if (!name || !templateData) {
        return res.status(400).json({ error: 'Name and template data are required' });
    }

    const templateDataJson = JSON.stringify(templateData);

    db.run(
        'UPDATE week_plan_templates SET name = ?, description = ?, template_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, description || '', templateDataJson, req.params.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Template not found' });
            }
            res.json({ message: 'Template updated successfully' });
        }
    );
});

// Delete template
app.delete('/weekplan/templates/:id', (req, res) => {
    db.run('DELETE FROM week_plan_templates WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.json({ message: 'Template deleted successfully' });
    });
});

// ========== MANUAL SHOPPING ITEMS ENDPOINTS ==========

// Get all manual shopping items
app.get('/shopping/manual', (req, res) => {
    db.all('SELECT * FROM manual_shopping_items ORDER BY created_at DESC', [], (err, items) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(items);
    });
});

// Add manual shopping item
app.post('/shopping/manual', (req, res) => {
    const { id, name, amount, unit, category } = req.body;

    if (!name || !amount || !unit) {
        return res.status(400).json({ error: 'Name, amount and unit are required' });
    }

    db.run(
        'INSERT INTO manual_shopping_items (id, name, amount, unit, category) VALUES (?, ?, ?, ?, ?)',
        [id, name, amount, unit, category || 'Sonstiges'],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({
                message: 'Manual shopping item added successfully',
                id: id
            });
        }
    );
});

// Delete manual shopping item
app.delete('/shopping/manual/:id', (req, res) => {
    db.run('DELETE FROM manual_shopping_items WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json({ message: 'Manual shopping item deleted successfully' });
    });
});

// Delete all manual shopping items
app.delete('/shopping/manual', (req, res) => {
    db.run('DELETE FROM manual_shopping_items', [], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'All manual shopping items deleted successfully' });
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
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

// Helper function to fetch and extract text from URL
async function fetchRecipeFromUrl(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
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
    } catch (error) {
        throw new Error(`Failed to fetch URL: ${error.message}`);
    }
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
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing database...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        }
        process.exit(0);
    });
});
