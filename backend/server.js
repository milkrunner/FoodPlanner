require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const rateLimit = require('express-rate-limit');
const cheerio = require('cheerio');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const db = require('./db');
const { logger, requestLogger } = require('./utils/logger');
const { resolveFavoriteFlagFromBody, resolveToggleTarget } = require('./utils/favorites');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Middleware
app.use(cors()); // Allow all origins
app.use(bodyParser.json({ limit: '10mb' }));
app.use(requestLogger);

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'FoodPlanner API Dokumentation'
}));

// Serve OpenAPI spec as JSON
app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

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
        logger.warn('General API rate limit exceeded', {
            component: 'rate-limit',
            ip: req.ip,
            method: req.method,
            path: req.path,
            requestId: req.requestId
        });
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
        logger.warn('AI API rate limit exceeded', {
            component: 'rate-limit',
            ip: req.ip,
            method: req.method,
            path: req.path,
            requestId: req.requestId
        });
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
        logger.error('Failed to connect to database. Exiting...', { component: 'database' });
        process.exit(1);
    }
    logger.info('Database connection established', { component: 'database' });
})();

// ========== RECIPES ENDPOINTS ==========

// Default pagination settings
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const parseNullableInt = (value) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
};

const parseNullableText = (value) => {
    if (value === undefined || value === null) {
        return null;
    }
    const trimmed = String(value).trim();
    return trimmed.length === 0 ? null : trimmed;
};

const parseBooleanFlag = (value, fallback = false) => {
    if (value === undefined || value === null) {
        return fallback;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
            return true;
        }
        if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
            return false;
        }
    }
    return fallback;
};

// Get all recipes - Optimized with single JOIN query and pagination
// Query params: page (default: 1), pageSize (default: 20, max: 100), all (if true, returns all recipes)
app.get('/recipes', async (req, res) => {
    try {
        const startTime = Date.now();

        // Parse pagination parameters
        const returnAll = req.query.all === 'true';
        const favoritesOnly = req.query.favorites === 'true';
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = returnAll ? null : Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.pageSize) || DEFAULT_PAGE_SIZE));
        const offset = returnAll ? 0 : (page - 1) * pageSize;

        // Get total count for pagination metadata
        const countQuery = favoritesOnly
            ? 'SELECT COUNT(*) FROM recipes WHERE is_favorite = TRUE'
            : 'SELECT COUNT(*) FROM recipes';
        const { rows: countResult } = await db.query(countQuery);
        const totalItems = parseInt(countResult[0].count);

        // Single query with JSON aggregation - replaces N+1 queries
        const query = `
            SELECT
                r.id,
                r.name,
                r.category,
                r.servings,
                r.instructions,
                r.is_favorite,
                r.prep_time,
                r.cook_time,
                r.difficulty,
                r.is_meal_prep_suitable,
                r.meal_prep_fridge_days,
                r.meal_prep_freezer_days,
                r.meal_prep_reheat_tips,
                r.meal_prep_batch_notes,
                r.created_at,
                r.updated_at,
                COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'name', i.name,
                        'amount', i.amount,
                        'unit', i.unit,
                        'category', i.category
                    )) FILTER (WHERE i.name IS NOT NULL),
                    '[]'::json
                ) as ingredients,
                COALESCE(
                    json_agg(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL),
                    '[]'::json
                ) as tags
            FROM recipes r
            LEFT JOIN ingredients i ON r.id = i.recipe_id
            LEFT JOIN recipe_tags t ON r.id = t.recipe_id
            ${favoritesOnly ? 'WHERE r.is_favorite = TRUE' : ''}
            GROUP BY r.id, r.name, r.category, r.servings, r.instructions, r.is_favorite, r.prep_time, r.cook_time, r.difficulty, r.created_at, r.updated_at
            ORDER BY r.created_at DESC
            ${returnAll ? '' : 'LIMIT $1 OFFSET $2'}
        `;

        const { rows } = returnAll
            ? await db.query(query)
            : await db.query(query, [pageSize, offset]);

        const queryTime = Date.now() - startTime;
        logger.debug('Recipes fetched', {
            requestId: req.requestId,
            count: rows.length,
            totalItems,
            page: returnAll ? 'all' : page,
            favoritesOnly,
            duration: queryTime,
            component: 'recipes'
        });

        // Return paginated response
        res.json({
            recipes: rows,
            pagination: {
                page: returnAll ? 1 : page,
                pageSize: returnAll ? totalItems : pageSize,
                totalItems,
                totalPages: returnAll ? 1 : Math.ceil(totalItems / pageSize),
                hasNextPage: returnAll ? false : page * pageSize < totalItems,
                hasPrevPage: returnAll ? false : page > 1
            }
        });
    } catch (error) {
        logger.error('Error fetching recipes', {
            requestId: req.requestId,
            error: error.message,
            stack: error.stack,
            component: 'recipes'
        });
        res.status(500).json({ error: error.message });
    }
});

// Get recipes filtered by season (recipes with seasonal ingredients)
// NOTE: This route must be defined BEFORE /recipes/:id to avoid "seasonal" being matched as an ID
app.get('/recipes/seasonal', async (req, res) => {
    try {
        const { season, minScore } = req.query;
        const minimumScore = parseInt(minScore) || 30;
        const currentSeason = getCurrentSeason();
        const seasonKey = season || currentSeason.key;

        const { rows } = await db.query(`
            SELECT
                r.id,
                r.name,
                r.category,
                r.servings,
                r.instructions,
                r.is_favorite,
                r.created_at,
                COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'name', i.name,
                        'amount', i.amount,
                        'unit', i.unit,
                        'category', i.category
                    )) FILTER (WHERE i.name IS NOT NULL),
                    '[]'::json
                ) as ingredients,
                COALESCE(
                    json_agg(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL),
                    '[]'::json
                ) as tags
            FROM recipes r
            LEFT JOIN ingredients i ON r.id = i.recipe_id
            LEFT JOIN recipe_tags t ON r.id = t.recipe_id
            GROUP BY r.id
            ORDER BY r.created_at DESC
        `);

        const seasonalRecipes = rows
            .map(recipe => {
                const score = calculateSeasonalScore(recipe.ingredients, seasonKey);
                const seasonalIngredients = recipe.ingredients.filter(ing =>
                    isIngredientInSeason(ing.name, seasonKey)
                );

                return {
                    ...recipe,
                    seasonalScore: score,
                    seasonalIngredients: seasonalIngredients.map(i => i.name),
                    seasonInfo: {
                        season: SEASONAL_CALENDAR[seasonKey].name,
                        seasonKey,
                        score,
                        seasonalCount: seasonalIngredients.length,
                        totalIngredients: recipe.ingredients.length
                    }
                };
            })
            .filter(recipe => recipe.seasonalScore >= minimumScore)
            .sort((a, b) => b.seasonalScore - a.seasonalScore);

        res.json({
            season: SEASONAL_CALENDAR[seasonKey].name,
            seasonKey,
            minimumScore,
            totalRecipes: rows.length,
            seasonalRecipes: seasonalRecipes.length,
            recipes: seasonalRecipes
        });
    } catch (error) {
        logger.error('Error fetching seasonal recipes', { error: error.message, requestId: req.requestId, component: 'seasons' });
        res.status(500).json({ error: error.message });
    }
});

// Get seasonal recommendations for the start page
app.get('/recipes/seasonal/recommendations', async (req, res) => {
    try {
        const { limit } = req.query;
        const maxResults = Math.min(parseInt(limit) || 6, 20);
        const currentSeason = getCurrentSeason();

        const { rows } = await db.query(`
            SELECT
                r.id,
                r.name,
                r.category,
                r.servings,
                r.is_favorite,
                COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'name', i.name,
                        'amount', i.amount,
                        'unit', i.unit,
                        'category', i.category
                    )) FILTER (WHERE i.name IS NOT NULL),
                    '[]'::json
                ) as ingredients,
                COALESCE(
                    json_agg(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL),
                    '[]'::json
                ) as tags
            FROM recipes r
            LEFT JOIN ingredients i ON r.id = i.recipe_id
            LEFT JOIN recipe_tags t ON r.id = t.recipe_id
            GROUP BY r.id
            ORDER BY r.created_at DESC
        `);

        const recommendations = rows
            .map(recipe => {
                const score = calculateSeasonalScore(recipe.ingredients);
                const seasonalIngredients = recipe.ingredients.filter(ing =>
                    isIngredientInSeason(ing.name)
                );

                return {
                    id: recipe.id,
                    name: recipe.name,
                    category: recipe.category,
                    servings: recipe.servings,
                    is_favorite: recipe.is_favorite,
                    tags: recipe.tags,
                    seasonalScore: score,
                    seasonalIngredients: seasonalIngredients.map(i => i.name),
                    totalIngredients: recipe.ingredients.length
                };
            })
            .filter(recipe => recipe.seasonalScore >= 30)
            .sort((a, b) => b.seasonalScore - a.seasonalScore)
            .slice(0, maxResults);

        res.json({
            season: currentSeason.name,
            seasonKey: currentSeason.key,
            topSeasonalIngredients: currentSeason.ingredients.slice(0, 8),
            recommendations
        });
    } catch (error) {
        logger.error('Error fetching seasonal recommendations', { error: error.message, requestId: req.requestId, component: 'seasons' });
        res.status(500).json({ error: error.message });
    }
});

// Get recipe by ID - Optimized with single JOIN query
app.get('/recipes/:id', async (req, res) => {
    try {
        const startTime = Date.now();

        // Single query with JSON aggregation - replaces 3 separate queries
        const { rows } = await db.query(`
            SELECT
                r.id,
                r.name,
                r.category,
                r.servings,
                r.instructions,
                r.is_favorite,
                r.prep_time,
                r.cook_time,
                r.difficulty,
                r.is_meal_prep_suitable,
                r.meal_prep_fridge_days,
                r.meal_prep_freezer_days,
                r.meal_prep_reheat_tips,
                r.meal_prep_batch_notes,
                r.created_at,
                r.updated_at,
                COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'name', i.name,
                        'amount', i.amount,
                        'unit', i.unit,
                        'category', i.category
                    )) FILTER (WHERE i.name IS NOT NULL),
                    '[]'::json
                ) as ingredients,
                COALESCE(
                    json_agg(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL),
                    '[]'::json
                ) as tags
            FROM recipes r
            LEFT JOIN ingredients i ON r.id = i.recipe_id
            LEFT JOIN recipe_tags t ON r.id = t.recipe_id
            WHERE r.id = $1
            GROUP BY r.id, r.name, r.category, r.servings, r.instructions, r.is_favorite, r.prep_time, r.cook_time, r.difficulty, r.created_at, r.updated_at
        `, [req.params.id]);

        const queryTime = Date.now() - startTime;

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        logger.debug('Recipe fetched', {
            requestId: req.requestId,
            recipeId: req.params.id,
            duration: queryTime,
            component: 'recipes'
        });
        res.json(rows[0]);
    } catch (error) {
        logger.error('Error fetching recipe', {
            requestId: req.requestId,
            recipeId: req.params.id,
            error: error.message,
            stack: error.stack,
            component: 'recipes'
        });
        res.status(500).json({ error: error.message });
    }
});

// Create recipe
app.post('/recipes', async (req, res) => {
    const {
        id,
        name,
        category,
        servings,
        instructions,
        ingredients,
        tags,
        prep_time,
        cook_time,
        difficulty,
        is_meal_prep_suitable,
        meal_prep_fridge_days,
        meal_prep_freezer_days,
        meal_prep_reheat_tips,
        meal_prep_batch_notes
    } = req.body;
    const favoriteValue = resolveFavoriteFlagFromBody(req.body, false);
    const mealPrepSuitable = parseBooleanFlag(is_meal_prep_suitable ?? req.body?.isMealPrepSuitable, false);
    const mealPrepFridgeDays = parseNullableInt(meal_prep_fridge_days ?? req.body?.mealPrepFridgeDays);
    const mealPrepFreezerDays = parseNullableInt(meal_prep_freezer_days ?? req.body?.mealPrepFreezerDays);
    const mealPrepReheatTips = parseNullableText(meal_prep_reheat_tips ?? req.body?.mealPrepReheatTips);
    const mealPrepBatchNotes = parseNullableText(meal_prep_batch_notes ?? req.body?.mealPrepBatchNotes);

    try {
        await db.transaction(async (client) => {
            // Insert recipe
            await client.query(
                `INSERT INTO recipes (
                    id,
                    name,
                    category,
                    servings,
                    instructions,
                    is_favorite,
                    prep_time,
                    cook_time,
                    difficulty,
                    is_meal_prep_suitable,
                    meal_prep_fridge_days,
                    meal_prep_freezer_days,
                    meal_prep_reheat_tips,
                    meal_prep_batch_notes
                ) VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9,
                    $10, $11, $12, $13, $14
                )`,
                [
                    id,
                    name,
                    category,
                    servings,
                    instructions,
                    favoriteValue,
                    prep_time || null,
                    cook_time || null,
                    difficulty || null,
                    mealPrepSuitable,
                    mealPrepFridgeDays,
                    mealPrepFreezerDays,
                    mealPrepReheatTips,
                    mealPrepBatchNotes
                ]
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

        res.status(201).json({ id, is_favorite: favoriteValue, message: 'Recipe created successfully' });
    } catch (error) {
        logger.error('Error creating recipe', { error: error.message, requestId: req.requestId, component: 'recipes' });
        res.status(500).json({ error: error.message });
    }
});

// Update recipe
app.put('/recipes/:id', async (req, res) => {
    const {
        name,
        category,
        servings,
        instructions,
        ingredients,
        tags,
        prep_time,
        cook_time,
        difficulty,
        is_meal_prep_suitable,
        meal_prep_fridge_days,
        meal_prep_freezer_days,
        meal_prep_reheat_tips,
        meal_prep_batch_notes
    } = req.body;
    const favoriteValue = resolveFavoriteFlagFromBody(req.body, null);
    let updatedFavorite = favoriteValue;
    const mealPrepSuitable = parseBooleanFlag(is_meal_prep_suitable ?? req.body?.isMealPrepSuitable, null);
    const mealPrepFridgeDays = parseNullableInt(meal_prep_fridge_days ?? req.body?.mealPrepFridgeDays);
    const mealPrepFreezerDays = parseNullableInt(meal_prep_freezer_days ?? req.body?.mealPrepFreezerDays);
    const mealPrepReheatTips = parseNullableText(meal_prep_reheat_tips ?? req.body?.mealPrepReheatTips);
    const mealPrepBatchNotes = parseNullableText(meal_prep_batch_notes ?? req.body?.mealPrepBatchNotes);

    try {
        await db.transaction(async (client) => {
            // Update recipe
            const { rows: recipeRows } = await client.query(
                `UPDATE recipes SET
                    name = $1,
                    category = $2,
                    servings = $3,
                    instructions = $4,
                    is_favorite = COALESCE($5, is_favorite),
                    prep_time = $6,
                    cook_time = $7,
                    difficulty = $8,
                    is_meal_prep_suitable = COALESCE($9, is_meal_prep_suitable),
                    meal_prep_fridge_days = $10,
                    meal_prep_freezer_days = $11,
                    meal_prep_reheat_tips = $12,
                    meal_prep_batch_notes = $13
                 WHERE id = $14
                 RETURNING is_favorite, is_meal_prep_suitable`,
                [
                    name,
                    category,
                    servings,
                    instructions,
                    favoriteValue,
                    prep_time || null,
                    cook_time || null,
                    difficulty || null,
                    mealPrepSuitable,
                    mealPrepFridgeDays,
                    mealPrepFreezerDays,
                    mealPrepReheatTips,
                    mealPrepBatchNotes,
                    req.params.id
                ]
            );
            if (recipeRows[0]) {
                updatedFavorite = recipeRows[0].is_favorite;
            }

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

        res.json({ message: 'Recipe updated successfully', is_favorite: updatedFavorite });
    } catch (error) {
        logger.error('Error updating recipe', { error: error.message, recipeId: req.params.id, requestId: req.requestId, component: 'recipes' });
        res.status(500).json({ error: error.message });
    }
});

// Toggle favorite status
app.put('/recipes/:id/favorite', async (req, res) => {
    try {
        const recipeId = req.params.id;
        const { rows: existingRows } = await db.query('SELECT is_favorite FROM recipes WHERE id = $1', [recipeId]);
        if (existingRows.length === 0) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        const favoriteValue = resolveToggleTarget(req.body, existingRows[0].is_favorite);

        const { rows, rowCount } = await db.query(
            'UPDATE recipes SET is_favorite = $1 WHERE id = $2 RETURNING id, is_favorite',
            [favoriteValue, recipeId]
        );

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Recipe not found' });
        }

        logger.info('Recipe favorite status updated', {
            requestId: req.requestId,
            recipeId,
            is_favorite: rows[0].is_favorite,
            component: 'recipes'
        });

        res.json({
            id: rows[0].id,
            is_favorite: rows[0].is_favorite,
            message: rows[0].is_favorite ? 'Recipe marked as favorite' : 'Recipe removed from favorites'
        });
    } catch (error) {
        logger.error('Error toggling recipe favorite', {
            requestId: req.requestId,
            recipeId: req.params.id,
            error: error.message,
            stack: error.stack,
            component: 'recipes'
        });
        res.status(500).json({ error: error.message });
    }
});

// Delete recipe
app.delete('/recipes/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM recipes WHERE id = $1', [req.params.id]);
        res.json({ message: 'Recipe deleted successfully' });
    } catch (error) {
        logger.error('Error deleting recipe', { error: error.message, recipeId: req.params.id, requestId: req.requestId, component: 'recipes' });
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
            mealPrepPlan: weekPlan.meal_prep_plan || {},
            days: daysWithMeals.map(d => ({
                date: d.date,
                dayName: d.day_name,
                meals: d.meals
            }))
        });
    } catch (error) {
        logger.error('Error fetching week plan', { error: error.message, requestId: req.requestId, component: 'weekplan' });
        res.status(500).json({ error: error.message });
    }
});

// Save week plan (supports multiple weeks)
app.post('/weekplan', async (req, res) => {
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

// Delete week plan
app.delete('/weekplan', async (req, res) => {
    try {
        await db.query('DELETE FROM week_plans');
        res.json({ message: 'Week plan deleted successfully' });
    } catch (error) {
        logger.error('Error deleting week plan', { error: error.message, requestId: req.requestId, component: 'weekplan' });
        res.status(500).json({ error: error.message });
    }
});

// Get week plan by date (finds week containing the given date)
app.get('/weekplan/by-date/:date', async (req, res) => {
    try {
        // Parse date string directly - expected format: YYYY-MM-DD
        const dateStr = req.params.date.split('T')[0];

        // Find the week plan where the requested date falls within the 7-day range
        // This is more robust than calculating Monday, as it handles timezone edge cases
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
            mealPrepPlan: weekPlan.meal_prep_plan || {},
            days: daysWithMeals.map(d => ({
                date: d.date,
                dayName: d.day_name,
                meals: d.meals
            }))
        });
    } catch (error) {
        logger.error('Error fetching week plan by date', { error: error.message, date: req.params.date, requestId: req.requestId, component: 'weekplan' });
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
        logger.error('Error fetching templates', { error: error.message, requestId: req.requestId, component: 'templates' });
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
        logger.error('Error fetching template', { error: error.message, templateId: req.params.id, requestId: req.requestId, component: 'templates' });
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
        logger.error('Error saving template', { error: error.message, requestId: req.requestId, component: 'templates' });
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
        logger.error('Error updating template', { error: error.message, templateId: req.params.id, requestId: req.requestId, component: 'templates' });
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
        logger.error('Error deleting template', { error: error.message, templateId: req.params.id, requestId: req.requestId, component: 'templates' });
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
        logger.error('Error fetching manual shopping items', { error: error.message, requestId: req.requestId, component: 'shopping' });
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
        logger.error('Error adding manual shopping item', { error: error.message, requestId: req.requestId, component: 'shopping' });
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
        logger.error('Error deleting manual shopping item', { error: error.message, itemId: req.params.id, requestId: req.requestId, component: 'shopping' });
        res.status(500).json({ error: error.message });
    }
});

// Delete all manual shopping items
app.delete('/shopping/manual', async (req, res) => {
    try {
        await db.query('DELETE FROM manual_shopping_items');
        res.json({ message: 'All manual shopping items deleted successfully' });
    } catch (error) {
        logger.error('Error deleting all manual shopping items', { error: error.message, requestId: req.requestId, component: 'shopping' });
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
        logger.error('Error fetching budget', { error: error.message, weekStart: req.params.weekStart, requestId: req.requestId, component: 'budget' });
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
        logger.error('Error saving budget', { error: error.message, requestId: req.requestId, component: 'budget' });
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
        logger.error('Error fetching substitutions', { error: error.message, requestId: req.requestId, component: 'substitutions' });
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
        logger.error('Error saving substitution', { error: error.message, requestId: req.requestId, component: 'substitutions' });
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
        logger.error('Error deactivating substitution', { error: error.message, substitutionId: req.params.id, requestId: req.requestId, component: 'substitutions' });
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
        logger.error('Shopping optimization error', { error: error.message, requestId: req.requestId, component: 'ai' });
        res.status(500).json({
            error: 'Failed to optimize shopping list',
            details: error.message
        });
    }
});

// ========== PANTRY / INGREDIENT INVENTORY ENDPOINTS ==========

app.get('/pantry', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM pantry_items ORDER BY expiry_date ASC NULLS LAST, name ASC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching pantry items:', error);
        res.status(500).json({ error: 'Failed to fetch pantry items' });
    }
});

app.get('/pantry/expiring', async (req, res) => {
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
        console.error('Error fetching expiring pantry items:', error);
        res.status(500).json({ error: 'Failed to fetch expiring pantry items' });
    }
});

app.post('/pantry', async (req, res) => {
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
        console.error('Error creating pantry item:', error);
        res.status(500).json({ error: 'Failed to create pantry item' });
    }
});

app.put('/pantry/:id', async (req, res) => {
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
        console.error('Error updating pantry item:', error);
        res.status(500).json({ error: 'Failed to update pantry item' });
    }
});

app.delete('/pantry/:id', async (req, res) => {
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
        console.error('Error deleting pantry item:', error);
        res.status(500).json({ error: 'Failed to delete pantry item' });
    }
});

// ========== HEALTH CHECK ENDPOINTS ==========

// Track server start time for uptime calculation
const serverStartTime = Date.now();

// Basic health check - fast response for load balancers (< 100ms)
app.get('/health', (req, res) => {
    res.json({
        status: 'UP',
        timestamp: new Date().toISOString()
    });
});

// Readiness probe - checks if app is ready to serve traffic (includes DB check)
app.get('/health/ready', async (req, res) => {
    try {
        const start = Date.now();
        await db.query('SELECT 1');
        const dbLatency = Date.now() - start;

        res.json({
            status: 'UP',
            timestamp: new Date().toISOString(),
            checks: {
                database: {
                    status: 'UP',
                    latency: dbLatency
                }
            }
        });
    } catch (error) {
        res.status(503).json({
            status: 'DOWN',
            timestamp: new Date().toISOString(),
            checks: {
                database: {
                    status: 'DOWN',
                    error: error.message
                }
            }
        });
    }
});

// Detailed health check - comprehensive system status
app.get('/health/detailed', async (req, res) => {
    const checks = {};
    let overallStatus = 'UP';

    // Database check
    try {
        const start = Date.now();
        await db.query('SELECT 1');
        const dbLatency = Date.now() - start;
        checks.database = {
            status: 'UP',
            latency: dbLatency
        };
    } catch (error) {
        checks.database = {
            status: 'DOWN',
            error: error.message
        };
        overallStatus = 'DOWN';
    }

    // Gemini API check
    checks.geminiApi = {
        status: genAI ? 'UP' : 'UNCONFIGURED',
        configured: !!genAI
    };

    // Memory usage
    const memUsage = process.memoryUsage();
    checks.memory = {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        unit: 'MB'
    };

    // Uptime
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

    // Version from package.json
    const packageJson = require('./package.json');

    const statusCode = overallStatus === 'UP' ? 200 : 503;
    res.status(statusCode).json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: packageJson.version,
        uptime: uptimeSeconds,
        uptimeHuman: formatUptime(uptimeSeconds),
        checks
    });
});

// Helper function to format uptime
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
}

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
        logger.error('Error fetching cooking history', { error: error.message, requestId: req.requestId, component: 'cooking-history' });
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
        logger.error('Error fetching cooking stats', { error: error.message, requestId: req.requestId, component: 'cooking-history' });
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
        logger.error('Error fetching recipe cooking history', { error: error.message, recipeId: req.params.recipeId, requestId: req.requestId, component: 'cooking-history' });
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
        logger.error('Error marking recipe as cooked', { error: error.message, recipeId: req.body.recipeId, requestId: req.requestId, component: 'cooking-history' });
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
        logger.error('Error deleting cooking history entry', { error: error.message, entryId: req.params.id, requestId: req.requestId, component: 'cooking-history' });
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
        logger.error('Error fetching not recently cooked recipes', { error: error.message, days: req.query.days, requestId: req.requestId, component: 'cooking-history' });
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
        logger.error('AI generation error', { error: error.message, requestId: req.requestId, component: 'ai' });
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
            logger.error('AI categorization error', { error: aiError.message, ingredient: ingredientName, requestId: req.requestId, component: 'ai' });
            // AI failed, use rule-based
            return res.json({ category: ruleBased, source: 'rule-based-fallback' });
        }
    } catch (error) {
        logger.error('Categorization error', { error: error.message, requestId: req.requestId, component: 'ai' });
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

// ========== SEASONAL CALENDAR ==========

// Seasonal ingredient data - German seasons
const SEASONAL_CALENDAR = {
    // Frühling (März-Mai): 3, 4, 5
    spring: {
        name: 'Frühling',
        months: [3, 4, 5],
        ingredients: [
            'spargel', 'rhabarber', 'bärlauch', 'radieschen', 'spinat', 'rucola',
            'frühlingszwiebel', 'kohlrabi', 'mangold', 'kresse', 'schnittlauch',
            'petersilie', 'erdbeere', 'waldmeister', 'kopfsalat', 'feldsalat',
            'löwenzahn', 'brennnessel', 'sauerampfer', 'minze'
        ]
    },
    // Sommer (Juni-August): 6, 7, 8
    summer: {
        name: 'Sommer',
        months: [6, 7, 8],
        ingredients: [
            'tomate', 'tomaten', 'zucchini', 'gurke', 'paprika', 'aubergine',
            'bohne', 'bohnen', 'erbse', 'erbsen', 'mais', 'fenchel',
            'erdbeere', 'erdbeeren', 'himbeere', 'himbeeren', 'johannisbeere',
            'brombeere', 'heidelbeere', 'blaubeere', 'kirsche', 'kirschen',
            'pfirsich', 'aprikose', 'nektarine', 'melone', 'wassermelone',
            'basilikum', 'oregano', 'thymian', 'rosmarin', 'salbei',
            'mangold', 'salat', 'kopfsalat', 'eisbergsalat', 'lollo'
        ]
    },
    // Herbst (September-November): 9, 10, 11
    autumn: {
        name: 'Herbst',
        months: [9, 10, 11],
        ingredients: [
            'kürbis', 'hokkaido', 'butternut', 'pilz', 'pilze', 'champignon',
            'pfifferling', 'steinpilz', 'apfel', 'birne', 'zwetschge', 'pflaume',
            'traube', 'weintraube', 'quitte', 'kohl', 'weißkohl', 'rotkohl',
            'wirsing', 'grünkohl', 'rosenkohl', 'blumenkohl', 'brokkoli',
            'karotte', 'möhre', 'rote bete', 'sellerie', 'knollensellerie',
            'pastinake', 'kartoffel', 'süßkartoffel', 'maroni', 'kastanie',
            'walnuss', 'haselnuss', 'lauch', 'porree', 'fenchel', 'chinakohl'
        ]
    },
    // Winter (Dezember-Februar): 12, 1, 2
    winter: {
        name: 'Winter',
        months: [12, 1, 2],
        ingredients: [
            'grünkohl', 'rosenkohl', 'wirsing', 'weißkohl', 'rotkohl', 'chinakohl',
            'feldsalat', 'chicorée', 'radicchio', 'endivie', 'schwarzwurzel',
            'topinambur', 'pastinake', 'steckrübe', 'rote bete', 'sellerie',
            'kartoffel', 'karotte', 'möhre', 'lauch', 'porree', 'zwiebel',
            'knoblauch', 'meerrettich', 'apfel', 'birne', 'orange', 'mandarine',
            'clementine', 'grapefruit', 'zitrone', 'granatapfel', 'kaki'
        ]
    }
};

// Get current season based on month
function getCurrentSeason() {
    const month = new Date().getMonth() + 1; // JavaScript months are 0-indexed

    for (const [season, data] of Object.entries(SEASONAL_CALENDAR)) {
        if (data.months.includes(month)) {
            return { key: season, ...data };
        }
    }
    return { key: 'spring', ...SEASONAL_CALENDAR.spring }; // Fallback
}

// Check if an ingredient is in season
function isIngredientInSeason(ingredientName, seasonKey = null) {
    const lowerName = ingredientName.toLowerCase();
    const season = seasonKey ? SEASONAL_CALENDAR[seasonKey] : getCurrentSeason();

    return season.ingredients.some(seasonal =>
        lowerName.includes(seasonal) || seasonal.includes(lowerName)
    );
}

// Calculate seasonal score for a recipe (percentage of seasonal ingredients)
function calculateSeasonalScore(ingredients, seasonKey = null) {
    if (!ingredients || ingredients.length === 0) return 0;

    const seasonalCount = ingredients.filter(ing =>
        isIngredientInSeason(ing.name, seasonKey)
    ).length;

    return Math.round((seasonalCount / ingredients.length) * 100);
}

// Get seasonal information for ingredients
function getSeasonalInfo(ingredients) {
    const currentSeason = getCurrentSeason();

    return ingredients.map(ing => ({
        ...ing,
        isInSeason: isIngredientInSeason(ing.name),
        seasonalNote: isIngredientInSeason(ing.name)
            ? `In Saison (${currentSeason.name})`
            : null
    }));
}

// ========== SEASONAL API ENDPOINTS ==========

// Get current season info and calendar
app.get('/seasons', (req, res) => {
    const currentSeason = getCurrentSeason();

    res.json({
        current: {
            key: currentSeason.key,
            name: currentSeason.name,
            months: currentSeason.months,
            topIngredients: currentSeason.ingredients.slice(0, 15)
        },
        calendar: Object.entries(SEASONAL_CALENDAR).map(([key, data]) => ({
            key,
            name: data.name,
            months: data.months,
            ingredientCount: data.ingredients.length,
            sampleIngredients: data.ingredients.slice(0, 10)
        }))
    });
});

// Get seasonal ingredients for a specific season or current season
app.get('/seasons/:season/ingredients', (req, res) => {
    const { season } = req.params;

    if (season === 'current') {
        const currentSeason = getCurrentSeason();
        return res.json({
            season: currentSeason.name,
            seasonKey: currentSeason.key,
            ingredients: currentSeason.ingredients
        });
    }

    if (!SEASONAL_CALENDAR[season]) {
        return res.status(404).json({ error: 'Season not found. Valid seasons: spring, summer, autumn, winter' });
    }

    const seasonData = SEASONAL_CALENDAR[season];
    res.json({
        season: seasonData.name,
        seasonKey: season,
        ingredients: seasonData.ingredients
    });
});

// Check if specific ingredients are in season
app.post('/seasons/check', (req, res) => {
    const { ingredients, season } = req.body;

    if (!ingredients || !Array.isArray(ingredients)) {
        return res.status(400).json({ error: 'ingredients array is required' });
    }

    const currentSeason = getCurrentSeason();
    const seasonKey = season || currentSeason.key;

    const result = ingredients.map(ing => {
        const name = typeof ing === 'string' ? ing : ing.name;
        return {
            name,
            isInSeason: isIngredientInSeason(name, seasonKey),
            season: SEASONAL_CALENDAR[seasonKey].name
        };
    });

    res.json({
        season: SEASONAL_CALENDAR[seasonKey].name,
        seasonKey,
        ingredients: result,
        seasonalCount: result.filter(i => i.isInSeason).length,
        totalCount: result.length
    });
});

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
        logger.error('AI portion scaling error', { error: error.message, requestId: req.requestId, component: 'ai' });
        res.status(500).json({
            error: 'Failed to scale portions',
            details: error.message
        });
    }
});

// ========== AI RECIPE IMPROVEMENT & VARIANTS ==========

// AI-based recipe analysis and improvement suggestions
app.post('/ai/analyze-recipe', aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    try {
        const { recipe } = req.body;

        if (!recipe || !recipe.name) {
            return res.status(400).json({ error: 'Recipe with name is required' });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const ingredientsList = recipe.ingredients && recipe.ingredients.length > 0
            ? recipe.ingredients.map(i => `- ${i.amount || ''} ${i.unit || ''} ${i.name}`.trim()).join('\n')
            : 'Keine Zutaten angegeben';

        const prompt = `Du bist ein erfahrener Koch und Ernährungsexperte. Analysiere das folgende Rezept und gib konkrete Verbesserungsvorschläge.

REZEPT:
Name: ${recipe.name}
Kategorie: ${recipe.category || 'Nicht angegeben'}
Portionen: ${recipe.servings || 'Nicht angegeben'}

Zutaten:
${ingredientsList}

Zubereitung:
${recipe.instructions || 'Keine Zubereitungsanleitung angegeben'}

Gib mir genau 4 Verbesserungsvorschläge in den folgenden Kategorien:
1. GESCHMACK: Wie kann der Geschmack verbessert oder intensiviert werden?
2. GESUNDHEIT: Welche gesünderen Alternativen oder Ergänzungen gibt es?
3. ZEITERSPARNIS: Tipps zur schnelleren oder effizienteren Zubereitung
4. PROFI-TIPP: Ein Küchen-Hack oder Geheimtipp von Profiköchen

WICHTIG: Antworte NUR mit einem validen JSON-Objekt im folgenden Format, ohne zusätzlichen Text:

{
  "recipeName": "${recipe.name}",
  "suggestions": [
    {
      "category": "Geschmack",
      "icon": "taste",
      "title": "Kurzer Titel",
      "description": "Detaillierte Beschreibung des Vorschlags (2-3 Sätze)",
      "impact": "high|medium|low"
    },
    {
      "category": "Gesundheit",
      "icon": "health",
      "title": "Kurzer Titel",
      "description": "Detaillierte Beschreibung",
      "impact": "high|medium|low"
    },
    {
      "category": "Zeitersparnis",
      "icon": "time",
      "title": "Kurzer Titel",
      "description": "Detaillierte Beschreibung",
      "impact": "high|medium|low"
    },
    {
      "category": "Profi-Tipp",
      "icon": "chef",
      "title": "Kurzer Titel",
      "description": "Detaillierte Beschreibung",
      "impact": "high|medium|low"
    }
  ],
  "overallRating": {
    "taste": 1-5,
    "health": 1-5,
    "difficulty": 1-5,
    "comment": "Kurze Gesamtbewertung des Rezepts"
  }
}`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Extract JSON from response
        let jsonText = text.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
        }

        const analysis = JSON.parse(jsonText);

        logger.info('Recipe analysis completed', { recipeName: recipe.name, requestId: req.requestId, component: 'ai' });
        res.json(analysis);
    } catch (error) {
        logger.error('AI recipe analysis error', { error: error.message, requestId: req.requestId, component: 'ai' });
        res.status(500).json({
            error: 'Failed to analyze recipe',
            details: error.message
        });
    }
});

// AI-based recipe variant generation
app.post('/ai/generate-variant', aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    try {
        const { recipe, variantType } = req.body;

        if (!recipe || !recipe.name) {
            return res.status(400).json({ error: 'Recipe with name is required' });
        }

        const validVariantTypes = ['vegetarisch', 'vegan', 'low-carb', 'glutenfrei', 'laktosefrei', 'schnell', 'kalorienarm'];
        if (!variantType || !validVariantTypes.includes(variantType)) {
            return res.status(400).json({
                error: `Invalid variant type. Valid types: ${validVariantTypes.join(', ')}`
            });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const ingredientsList = recipe.ingredients && recipe.ingredients.length > 0
            ? recipe.ingredients.map(i => `- ${i.amount || ''} ${i.unit || ''} ${i.name} (${i.category || 'Sonstiges'})`.trim()).join('\n')
            : 'Keine Zutaten angegeben';

        const variantDescriptions = {
            'vegetarisch': 'eine vegetarische Version (ohne Fleisch und Fisch, aber mit Milchprodukten und Eiern)',
            'vegan': 'eine vegane Version (komplett ohne tierische Produkte)',
            'low-carb': 'eine Low-Carb Version (wenig Kohlenhydrate, max 20g pro Portion)',
            'glutenfrei': 'eine glutenfreie Version (ohne Weizen, Roggen, Gerste, Dinkel)',
            'laktosefrei': 'eine laktosefreie Version (ohne Milchprodukte oder mit laktosefreien Alternativen)',
            'schnell': 'eine schnelle Version (Zubereitungszeit unter 30 Minuten)',
            'kalorienarm': 'eine kalorienarme Version (reduzierte Kalorien durch leichtere Zutaten)'
        };

        const prompt = `Du bist ein erfahrener Koch und Ernährungsexperte. Erstelle ${variantDescriptions[variantType]} des folgenden Rezepts.

ORIGINAL-REZEPT:
Name: ${recipe.name}
Kategorie: ${recipe.category || 'Nicht angegeben'}
Portionen: ${recipe.servings || 4}

Zutaten:
${ingredientsList}

Zubereitung:
${recipe.instructions || 'Keine Zubereitungsanleitung angegeben'}

Erstelle eine vollständige ${variantType} Variante dieses Rezepts. Die Variante soll:
- Den Charakter und Geschmack des Originals möglichst beibehalten
- Alle notwendigen Substitutionen enthalten
- Angepasste Zubereitungsanweisungen haben
- Realistisch und lecker sein

WICHTIG: Antworte NUR mit einem validen JSON-Objekt im folgenden Format, ohne zusätzlichen Text:

{
  "originalName": "${recipe.name}",
  "variantType": "${variantType}",
  "variantName": "Neuer Name für die Variante",
  "category": "${recipe.category || 'Hauptgericht'}",
  "servings": ${recipe.servings || 4},
  "changes": [
    "Beschreibung der wichtigsten Änderung 1",
    "Beschreibung der wichtigsten Änderung 2"
  ],
  "ingredients": [
    {
      "name": "Zutatname",
      "amount": "Menge als String",
      "unit": "Einheit",
      "category": "Obst & Gemüse|Milchprodukte|Fleisch & Fisch|Trockenwaren|Tiefkühl|Sonstiges",
      "isNew": true,
      "replaces": "Name der ersetzten Zutat oder null"
    }
  ],
  "instructions": "Vollständige Zubereitungsanleitung im Markdown-Format mit Schritt 1:, Schritt 2:, etc.",
  "nutritionNote": "Kurzer Hinweis zu den ernährungsphysiologischen Vorteilen dieser Variante",
  "difficulty": "einfach|mittel|anspruchsvoll",
  "prepTime": "Geschätzte Zubereitungszeit"
}`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Extract JSON from response
        let jsonText = text.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
        }

        const variant = JSON.parse(jsonText);

        logger.info('Recipe variant generated', { recipeName: recipe.name, variantType, requestId: req.requestId, component: 'ai' });
        res.json(variant);
    } catch (error) {
        logger.error('AI variant generation error', { error: error.message, requestId: req.requestId, component: 'ai' });
        res.status(500).json({
            error: 'Failed to generate recipe variant',
            details: error.message
        });
    }
});

// Get available variant types
app.get('/ai/variant-types', (req, res) => {
    res.json({
        variantTypes: [
            { id: 'vegetarisch', name: 'Vegetarisch', icon: '🥬', description: 'Ohne Fleisch und Fisch' },
            { id: 'vegan', name: 'Vegan', icon: '🌱', description: 'Ohne tierische Produkte' },
            { id: 'low-carb', name: 'Low-Carb', icon: '🥩', description: 'Wenig Kohlenhydrate' },
            { id: 'glutenfrei', name: 'Glutenfrei', icon: '🌾', description: 'Ohne Gluten' },
            { id: 'laktosefrei', name: 'Laktosefrei', icon: '🥛', description: 'Ohne Laktose' },
            { id: 'schnell', name: 'Schnelle Version', icon: '⚡', description: 'Unter 30 Minuten' },
            { id: 'kalorienarm', name: 'Kalorienarm', icon: '🪶', description: 'Reduzierte Kalorien' }
        ]
    });
});

// ========== AI NATURAL LANGUAGE SEARCH ==========

// AI-powered natural language recipe search
app.post('/ai/search', aiLimiter, async (req, res) => {
    const startTime = Date.now();
    const { query, recipes } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ error: 'Search query is required' });
    }

    if (!recipes || !Array.isArray(recipes) || recipes.length === 0) {
        return res.json({ results: [], searchInfo: { query, matchCount: 0, aiPowered: false } });
    }

    // If AI is not available, fall back to classic search
    if (!genAI) {
        logger.info('AI search fallback to classic search - Gemini not configured', {
            requestId: req.requestId,
            query: query.substring(0, 100)
        });
        const classicResults = classicSearch(query, recipes);
        return res.json({
            results: classicResults,
            searchInfo: {
                query,
                matchCount: classicResults.length,
                aiPowered: false,
                fallbackReason: 'AI service not configured'
            }
        });
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Get current context for better understanding
        const now = new Date();
        const hour = now.getHours();
        const month = now.getMonth();

        let timeOfDay = 'tagsüber';
        if (hour >= 5 && hour < 11) timeOfDay = 'morgens (Frühstück)';
        else if (hour >= 11 && hour < 14) timeOfDay = 'mittags (Mittagessen)';
        else if (hour >= 14 && hour < 18) timeOfDay = 'nachmittags';
        else if (hour >= 18 && hour < 22) timeOfDay = 'abends (Abendessen)';
        else timeOfDay = 'nachts';

        const seasons = ['Winter', 'Winter', 'Frühling', 'Frühling', 'Frühling', 'Sommer', 'Sommer', 'Sommer', 'Herbst', 'Herbst', 'Herbst', 'Winter'];
        const season = seasons[month];

        // Build recipe summary for AI
        const recipeSummary = recipes.map((r, idx) => {
            const ingredients = r.ingredients?.map(i => i.name).join(', ') || '';
            const tags = r.tags?.join(', ') || '';
            return `[${idx}] "${r.name}" | Kategorie: ${r.category || 'keine'} | Zutaten: ${ingredients} | Tags: ${tags}`;
        }).join('\n');

        const prompt = `Du bist ein intelligenter Rezept-Such-Assistent. Analysiere die Suchanfrage und finde die passendsten Rezepte.

SUCHANFRAGE: "${query}"

KONTEXT:
- Aktuelle Tageszeit: ${timeOfDay}
- Aktuelle Jahreszeit: ${season}

VERFÜGBARE REZEPTE:
${recipeSummary}

AUFGABE:
Analysiere die Suchanfrage semantisch und finde die relevantesten Rezepte. Berücksichtige:
1. Explizite Anforderungen (Zutaten, Kategorie, Ernährungsweise)
2. Implizite Hinweise (z.B. "schnell" = wenig Zutaten/einfach, "leicht" = Salate/Gemüse, "deftig" = Fleisch/Eintöpfe)
3. Tageszeit-Kontext (falls relevant für die Anfrage)
4. Jahreszeit-Kontext (falls relevant für die Anfrage)
5. Ähnlichkeiten auch ohne exakte Keyword-Treffer

Antworte NUR mit einem JSON-Objekt in diesem Format:
{
  "matches": [
    {"index": 0, "score": 95, "reason": "Kurze Begründung"},
    {"index": 3, "score": 80, "reason": "Kurze Begründung"}
  ],
  "interpretation": "Kurze Zusammenfassung wie du die Anfrage verstanden hast"
}

REGELN:
- Gib maximal 10 Matches zurück
- Score von 0-100 (100 = perfekte Übereinstimmung)
- Nur Rezepte mit Score >= 50 zurückgeben
- Sortiere nach Score absteigend
- Begründungen auf Deutsch, max 50 Zeichen
- Falls keine passenden Rezepte: leeres matches-Array`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid AI response format');
        }

        const aiResult = JSON.parse(jsonMatch[0]);

        // Map AI results back to actual recipes
        const results = (aiResult.matches || [])
            .filter(m => m.index >= 0 && m.index < recipes.length && m.score >= 50)
            .map(m => ({
                ...recipes[m.index],
                _searchScore: m.score,
                _searchReason: m.reason
            }));

        const duration = Date.now() - startTime;
        logger.info('AI search completed', {
            requestId: req.requestId,
            query: query.substring(0, 100),
            recipeCount: recipes.length,
            matchCount: results.length,
            duration,
            interpretation: aiResult.interpretation
        });

        res.json({
            results,
            searchInfo: {
                query,
                matchCount: results.length,
                aiPowered: true,
                interpretation: aiResult.interpretation,
                duration
            }
        });

    } catch (error) {
        logger.error('AI search error, falling back to classic search', {
            requestId: req.requestId,
            error: error.message,
            query: query.substring(0, 100)
        });

        // Fallback to classic search on error
        const classicResults = classicSearch(query, recipes);
        res.json({
            results: classicResults,
            searchInfo: {
                query,
                matchCount: classicResults.length,
                aiPowered: false,
                fallbackReason: error.message
            }
        });
    }
});

// Classic keyword-based search (fallback)
function classicSearch(query, recipes) {
    const searchTerms = query.toLowerCase().trim().split(/\s+/);

    return recipes
        .map(recipe => {
            let score = 0;
            const name = (recipe.name || '').toLowerCase();
            const category = (recipe.category || '').toLowerCase();
            const ingredients = (recipe.ingredients || []).map(i => i.name.toLowerCase());
            const tags = (recipe.tags || []).map(t => t.toLowerCase());

            for (const term of searchTerms) {
                // Name match (highest weight)
                if (name.includes(term)) score += 30;
                // Category match
                if (category.includes(term)) score += 20;
                // Ingredient match
                if (ingredients.some(i => i.includes(term))) score += 15;
                // Tag match
                if (tags.some(t => t.includes(term))) score += 10;
            }

            return { ...recipe, _searchScore: score };
        })
        .filter(r => r._searchScore > 0)
        .sort((a, b) => b._searchScore - a._searchScore)
        .slice(0, 10);
}

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
            logger.debug('Fetching recipe from URL', { url, requestId: req.requestId, component: 'ai' });

            try {
                input = await fetchRecipeFromUrl(url);
                logger.debug('Fetched content from URL', { contentLength: input.length, requestId: req.requestId, component: 'ai' });
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

        logger.debug('AI Response received', { responseLength: jsonText.length, requestId: req.requestId, component: 'ai' });

        // Remove markdown code blocks if present
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?$/g, '').trim();
        }

        // Parse the JSON
        let recipe;
        try {
            recipe = JSON.parse(jsonText);
        } catch (parseError) {
            logger.error('JSON parse error', { error: parseError.message, requestId: req.requestId, component: 'ai' });
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
        logger.error('Recipe parsing error', { error: error.message, requestId: req.requestId, component: 'ai' });
        res.status(500).json({
            error: 'Failed to parse recipe',
            details: error.message
        });
    }
});

// ========== VIDEO RECIPE PARSER ==========

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Supported video platforms with strict URL patterns
const VIDEO_PLATFORMS = {
    tiktok: /^https?:\/\/(www\.|vm\.)?tiktok\.com\//i,
    instagram: /^https?:\/\/(www\.)?instagram\.com\/(reel|p)\//i,
    pinterest: /^https?:\/\/(www\.)?pinterest\.(com|de)\/pin\//i,
    youtube: /^https?:\/\/(www\.)?(youtube\.com\/shorts|youtu\.be)\//i
};

// Check if URL is a supported video platform
function isVideoUrl(url) {
    return Object.values(VIDEO_PLATFORMS).some(regex => regex.test(url));
}

// Validate and sanitize URL to prevent command injection
function sanitizeVideoUrl(url) {
    // Must be a valid URL
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }

    // Must be http or https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
    }

    // Must match one of our supported platforms
    if (!isVideoUrl(url)) {
        return null;
    }

    // Return the sanitized URL (reconstructed from parsed components)
    return parsed.href;
}

// Download video using yt-dlp (using execFile to prevent command injection)
function downloadVideo(url, outputPath) {
    return new Promise((resolve, reject) => {
        // Validate URL before executing
        const sanitizedUrl = sanitizeVideoUrl(url);
        if (!sanitizedUrl) {
            reject(new Error('Invalid or unsupported video URL'));
            return;
        }

        // Use execFile with arguments array to prevent shell injection
        const args = [
            '-f', 'best[ext=mp4]/best',
            '--no-playlist',
            '--max-filesize', '50M',
            '-o', outputPath,
            sanitizedUrl
        ];

        execFile('yt-dlp', args, { timeout: 120000 }, (error, stdout, stderr) => {
            if (error) {
                logger.error('yt-dlp error', { error: error.message, stderr, component: 'video' });
                reject(new Error(`Video download failed: ${error.message}`));
                return;
            }
            resolve(outputPath);
        });
    });
}

// Clean up temporary files
function cleanupTempFiles(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (e) {
        logger.warn('Cleanup error', { error: e.message, filePath, component: 'video' });
    }
}

// Parse video recipe using Gemini
app.post('/ai/parse-video-recipe', aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    const { url, acceptDisclaimer } = req.body;

    if (!url || !url.trim()) {
        return res.status(400).json({
            error: 'Video URL is required'
        });
    }

    if (!acceptDisclaimer) {
        return res.status(400).json({
            error: 'You must accept the disclaimer to use this feature',
            requiresDisclaimer: true
        });
    }

    const videoUrl = url.trim();

    // Validate URL is from supported platform
    if (!isVideoUrl(videoUrl)) {
        return res.status(400).json({
            error: 'Unsupported video platform',
            hint: 'Supported platforms: TikTok, Instagram Reels, Pinterest, YouTube Shorts',
            supportedPlatforms: Object.keys(VIDEO_PLATFORMS)
        });
    }

    const tempDir = os.tmpdir();
    const videoId = Date.now().toString();
    const videoPath = path.join(tempDir, `recipe_video_${videoId}.mp4`);

    try {
        logger.debug('Downloading video', { url: videoUrl, requestId: req.requestId, component: 'video' });

        // Download the video
        await downloadVideo(videoUrl, videoPath);

        if (!fs.existsSync(videoPath)) {
            throw new Error('Video download failed - file not found');
        }

        const videoStats = fs.statSync(videoPath);
        logger.debug('Video downloaded', { sizeInMB: (videoStats.size / 1024 / 1024).toFixed(2), requestId: req.requestId, component: 'video' });

        // Check file size (Gemini limit is ~20MB for inline, we use File API for larger)
        if (videoStats.size > 20 * 1024 * 1024) {
            cleanupTempFiles(videoPath);
            return res.status(400).json({
                error: 'Video file too large. Maximum size is 20MB.',
                hint: 'Try a shorter video or lower quality.'
            });
        }

        // Read video file as base64
        const videoBuffer = fs.readFileSync(videoPath);
        const videoBase64 = videoBuffer.toString('base64');

        // Use Gemini with video
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Du bist ein intelligenter Rezept-Extraktor für Kochvideos. Analysiere dieses Video und extrahiere das gezeigte Rezept.

Achte besonders auf:
- Gesprochene Anweisungen und Zutatenlisten
- Sichtbare Zutaten und Mengenangaben
- Zubereitungsschritte die gezeigt oder erklärt werden
- Text-Overlays mit Rezeptinformationen

WICHTIG: Antworte NUR mit einem validen JSON-Objekt im folgenden Format:

{
    "name": "Rezeptname (aus dem Video oder passend zum Gericht)",
    "category": "Kategorie (Hauptgericht, Suppe, Salat, Dessert, Vorspeise, Beilage, Snack, Getränk)",
    "servings": 4,
    "prepTime": "15 Min",
    "cookTime": "30 Min",
    "difficulty": "Einfach|Mittel|Schwer",
    "ingredients": [
        {
            "name": "Zutatname",
            "amount": "200",
            "unit": "g",
            "category": "Obst & Gemüse|Milchprodukte|Fleisch & Fisch|Trockenwaren|Tiefkühl|Sonstiges"
        }
    ],
    "instructions": "Schritt 1: ... \\n\\nSchritt 2: ...",
    "tips": "Optionale Tipps aus dem Video",
    "sourceNote": "Kurze Beschreibung des Videos (z.B. 'TikTok Rezept von @username')"
}

Regeln:
- Extrahiere so viele Details wie möglich aus Audio UND Bild
- Wenn Mengen nicht genannt werden, schätze sinnvolle Standardwerte
- Strukturiere die Anleitung in klare, nummerierte Schritte
- Erkenne die Sprache des Videos und übersetze bei Bedarf ins Deutsche
- Bei unklaren Informationen, nutze dein Kochwissen für plausible Werte`;

        const result = await model.generateContent([
            { text: prompt },
            {
                inlineData: {
                    mimeType: 'video/mp4',
                    data: videoBase64
                }
            }
        ]);

        // Clean up video file
        cleanupTempFiles(videoPath);

        const response = result.response;
        let jsonText = response.text().trim();

        logger.debug('Video AI Response received', { responseLength: jsonText.length, requestId: req.requestId, component: 'video' });

        // Remove markdown code blocks if present
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?$/g, '').trim();
        }

        // Parse the JSON
        let recipe;
        try {
            recipe = JSON.parse(jsonText);
        } catch (parseError) {
            logger.error('JSON parse error', { error: parseError.message, requestId: req.requestId, component: 'video' });
            return res.status(500).json({
                error: 'Failed to parse AI response as JSON',
                details: parseError.message,
                hint: 'The video might not contain a clear recipe.'
            });
        }

        // Validate required fields
        if (!recipe.name || !recipe.ingredients || recipe.ingredients.length === 0) {
            return res.status(400).json({
                error: 'Could not extract a complete recipe from this video',
                hint: 'Make sure the video clearly shows or explains a recipe.',
                parsedData: recipe
            });
        }

        // Ensure all required fields have defaults
        recipe.id = Date.now().toString();
        recipe.category = recipe.category || 'Hauptgericht';
        recipe.servings = recipe.servings || 4;
        recipe.instructions = recipe.instructions || '';
        recipe.sourceUrl = videoUrl;

        // Validate ingredients
        recipe.ingredients = recipe.ingredients.map(ing => ({
            name: ing.name || '',
            amount: ing.amount || '1',
            unit: ing.unit || 'x',
            category: ing.category || 'Sonstiges'
        }));

        res.json({
            recipe,
            source: 'video-parsed',
            platform: Object.keys(VIDEO_PLATFORMS).find(p => VIDEO_PLATFORMS[p].test(videoUrl)) || 'unknown'
        });

    } catch (error) {
        // Clean up on error
        cleanupTempFiles(videoPath);

        logger.error('Video recipe parsing error', { error: error.message, requestId: req.requestId, component: 'video' });
        res.status(500).json({
            error: 'Failed to parse video recipe',
            details: error.message
        });
    }
});

// Get supported video platforms
app.get('/ai/video-platforms', (req, res) => {
    res.json({
        platforms: Object.keys(VIDEO_PLATFORMS),
        disclaimer: 'Dieses Feature ist nur für Videos gedacht, zu deren Nutzung du berechtigt bist. Die Originalvideos werden nicht gespeichert. Bitte respektiere die Urheberrechte der Content-Creator.'
    });
});

// AI-powered weekly meal plan generation
app.post('/ai/generate-weekplan', aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    try {
        const { mealTypes, days, preferences } = req.body;

        // Validate mealTypes
        const validMealTypes = ['Frühstück', 'Mittagessen', 'Abendessen'];
        if (!mealTypes || !Array.isArray(mealTypes) || mealTypes.length === 0) {
            return res.status(400).json({
                error: 'Bitte wähle mindestens eine Mahlzeit aus (Frühstück, Mittagessen, Abendessen)'
            });
        }

        const invalidMeals = mealTypes.filter(m => !validMealTypes.includes(m));
        if (invalidMeals.length > 0) {
            return res.status(400).json({
                error: `Ungültige Mahlzeiten: ${invalidMeals.join(', ')}. Erlaubt sind: ${validMealTypes.join(', ')}`
            });
        }

        // Default to 7 days if not specified
        const numDays = days && Number.isInteger(days) && days >= 1 && days <= 7 ? days : 7;

        // Fetch existing recipes for context
        let existingRecipes = [];
        try {
            const recipesResult = await db.query('SELECT name, category FROM recipes LIMIT 50');
            existingRecipes = recipesResult.rows.map(r => `${r.name} (${r.category || 'Ohne Kategorie'})`);
        } catch (dbError) {
            logger.warn('Could not fetch existing recipes for AI context', {
                error: dbError.message,
                requestId: req.requestId,
                component: 'ai'
            });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
        const selectedDays = dayNames.slice(0, numDays);

        const prompt = `Du bist ein erfahrener Ernährungsberater und Meal-Prep-Experte. Erstelle einen abwechslungsreichen Wochenplan für ${numDays} Tage.

Erstelle Vorschläge für folgende Mahlzeiten: ${mealTypes.join(', ')}
Tage: ${selectedDays.join(', ')}

${preferences?.dietary ? `Ernährungspräferenzen: ${preferences.dietary}` : ''}
${preferences?.cuisines ? `Bevorzugte Küchen: ${preferences.cuisines}` : ''}
${preferences?.avoidIngredients ? `Diese Zutaten vermeiden: ${preferences.avoidIngredients}` : ''}
${preferences?.budget ? `Budget: ${preferences.budget}` : ''}
${preferences?.cookingTime ? `Maximale Kochzeit: ${preferences.cookingTime === 'schnell' ? 'unter 30 Minuten' : preferences.cookingTime === 'mittel' ? '30-60 Minuten' : 'über 60 Minuten erlaubt'}` : ''}
${preferences?.cookingSkill ? `Kochkenntnisse: ${preferences.cookingSkill}` : ''}

${existingRecipes.length > 0 ? `
Der Nutzer hat bereits diese Rezepte in seiner Datenbank (nutze gerne ähnliche oder passende Vorschläge):
${existingRecipes.slice(0, 20).join(', ')}
` : ''}

Beachte folgende Regeln:
1. Sorge für Abwechslung - keine Wiederholungen innerhalb der Woche
2. Achte auf eine ausgewogene Ernährung
3. Frühstück sollte schnell und einfach sein
4. Mittagessen kann als Meal-Prep vorbereitet werden
5. Abendessen darf aufwändiger sein (besonders am Wochenende)
6. Nutze saisonale Zutaten

WICHTIG: Antworte NUR mit einem validen JSON-Objekt im folgenden Format, ohne zusätzlichen Text:

{
  "weekPlan": {
    "Montag": {
      "Frühstück": {
        "name": "Rezeptname",
        "description": "Kurzbeschreibung (1 Satz)",
        "category": "Kategorie",
        "servings": 2,
        "ingredients": [
          { "name": "Zutat 1", "amount": "200", "unit": "g", "category": "Obst & Gemüse" },
          { "name": "Zutat 2", "amount": "1", "unit": "Stück", "category": "Milchprodukte" }
        ],
        "instructions": "Schritt 1: ... Schritt 2: ... Schritt 3: ..."
      },
      "Mittagessen": { ... },
      "Abendessen": { ... }
    }
  },
  "shoppingTips": ["Tipp 1", "Tipp 2"],
  "mealPrepSuggestions": ["Vorschlag 1", "Vorschlag 2"]
}

Gib nur die ausgewählten Mahlzeiten (${mealTypes.join(', ')}) im JSON zurück.
Kategorien für Rezepte: Frühstück, Hauptgericht, Suppe, Salat, Snack, Dessert, Beilage, Getränk
Kategorien für Zutaten: Obst & Gemüse, Milchprodukte, Fleisch & Fisch, Trockenwaren, Tiefkühl, Sonstiges
Einheiten für Zutaten: g, kg, ml, l, Stück, EL, TL, Prise, Bund, Dose, Packung`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        let jsonText = response.text().trim();

        // Extract JSON from response (remove markdown code blocks if present)
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?$/g, '').trim();
        }

        const generatedPlan = JSON.parse(jsonText);

        // Validate response structure
        if (!generatedPlan.weekPlan || typeof generatedPlan.weekPlan !== 'object') {
            throw new Error('Invalid response structure: missing weekPlan');
        }

        // Save generated recipes to database and collect recipe IDs
        const savedRecipes = {};

        for (const [dayName, meals] of Object.entries(generatedPlan.weekPlan)) {
            savedRecipes[dayName] = {};

            for (const [mealType, meal] of Object.entries(meals)) {
                if (!meal || !meal.name) continue;

                try {
                    // Generate unique ID for the recipe
                    const recipeId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                    // Insert recipe into database
                    await db.query(
                        `INSERT INTO recipes (id, name, category, servings, instructions)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [
                            recipeId,
                            meal.name,
                            meal.category || 'Hauptgericht',
                            meal.servings || 2,
                            meal.instructions || meal.description || ''
                        ]
                    );

                    // Insert ingredients if provided
                    if (meal.ingredients && Array.isArray(meal.ingredients)) {
                        for (const ingredient of meal.ingredients) {
                            if (!ingredient.name) continue;

                            await db.query(
                                `INSERT INTO ingredients (recipe_id, name, amount, unit, category)
                                 VALUES ($1, $2, $3, $4, $5)`,
                                [
                                    recipeId,
                                    ingredient.name,
                                    ingredient.amount || '',
                                    ingredient.unit || '',
                                    ingredient.category || 'Sonstiges'
                                ]
                            );
                        }
                    }

                    // Store the recipe ID for the response
                    savedRecipes[dayName][mealType] = {
                        ...meal,
                        recipeId: recipeId
                    };

                    logger.info('AI recipe saved to database', {
                        recipeId,
                        recipeName: meal.name,
                        dayName,
                        mealType,
                        requestId: req.requestId,
                        component: 'ai'
                    });

                } catch (dbError) {
                    logger.error('Failed to save AI recipe to database', {
                        error: dbError.message,
                        recipeName: meal.name,
                        requestId: req.requestId,
                        component: 'ai'
                    });
                    // Continue with other recipes even if one fails
                    savedRecipes[dayName][mealType] = {
                        ...meal,
                        recipeId: null
                    };
                }
            }
        }

        logger.info('AI week plan generated successfully', {
            days: numDays,
            mealTypes,
            requestId: req.requestId,
            component: 'ai'
        });

        res.json({
            success: true,
            weekPlan: savedRecipes,
            shoppingTips: generatedPlan.shoppingTips || [],
            mealPrepSuggestions: generatedPlan.mealPrepSuggestions || [],
            metadata: {
                generatedAt: new Date().toISOString(),
                mealTypes,
                days: numDays
            }
        });

    } catch (error) {
        logger.error('AI week plan generation error', {
            error: error.message,
            requestId: req.requestId,
            component: 'ai'
        });

        // Check for JSON parse errors
        if (error instanceof SyntaxError) {
            return res.status(500).json({
                error: 'Die KI-Antwort konnte nicht verarbeitet werden. Bitte versuche es erneut.',
                details: 'JSON parsing failed'
            });
        }

        res.status(500).json({
            error: 'Fehler bei der Wochenplan-Generierung',
            details: error.message
        });
    }
});

app.post('/ai/meal-prep-suggestions', aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    const recipeCandidates = Array.isArray(req.body?.recipes) ? req.body.recipes : [];
    const prepDayLabel = parseNullableText(req.body?.prepDay) || 'Meal-Prep Tag';
    const eligibleRecipes = recipeCandidates
        .filter((recipe) => recipe && (recipe.is_meal_prep_suitable === true || recipe.isMealPrepSuitable === true))
        .map((recipe) => {
            const prepTime = parseNullableInt(recipe.prep_time ?? recipe.prepTime) || 0;
            const cookTime = parseNullableInt(recipe.cook_time ?? recipe.cookTime) || 0;
            const fridgeDays = parseNullableInt(recipe.meal_prep_fridge_days ?? recipe.mealPrepFridgeDays);
            const freezerDays = parseNullableInt(recipe.meal_prep_freezer_days ?? recipe.mealPrepFreezerDays);
            const targetPortions = parseNullableInt(recipe.targetPortions ?? recipe.totalPortions) || recipe.servings || null;
            const targetDates = Array.isArray(recipe.targetDates) ? recipe.targetDates : [];

            return {
                id: recipe.id,
                name: recipe.name,
                servings: recipe.servings || null,
                category: recipe.category || null,
                totalTime: prepTime + cookTime,
                prepTime,
                cookTime,
                difficulty: recipe.difficulty || null,
                fridgeDays,
                freezerDays,
                reheatTips: parseNullableText(recipe.meal_prep_reheat_tips ?? recipe.mealPrepReheatTips),
                batchNotes: parseNullableText(recipe.meal_prep_batch_notes ?? recipe.mealPrepBatchNotes),
                targetPortions,
                targetDates,
                mealTypes: Array.isArray(recipe.mealTypes) ? recipe.mealTypes : []
            };
        });

    if (eligibleRecipes.length === 0) {
        return res.status(400).json({
            error: 'Bitte übermittle mindestens ein Meal-Prep geeignetes Rezept.'
        });
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const recipeSummaries = eligibleRecipes.map((recipe, index) => {
            const parts = [
                `${index + 1}. ${recipe.name} (ID: ${recipe.id})`,
                recipe.category ? `Kategorie: ${recipe.category}` : null,
                recipe.servings ? `Standard-Portionen: ${recipe.servings}` : null,
                `Geschätzte Gesamtzeit: ${recipe.totalTime || 'unbekannt'} Minuten`,
                recipe.mealTypes.length ? `Geplante Mahlzeiten: ${recipe.mealTypes.join(', ')}` : null,
                recipe.targetPortions ? `Gewünschte Portionen: ${recipe.targetPortions}` : null,
                recipe.targetDates.length ? `Verbrauchstage: ${recipe.targetDates.join(', ')}` : null,
                recipe.fridgeDays ? `Kühlschrank: ${recipe.fridgeDays} Tage` : null,
                recipe.freezerDays ? `Gefrierschrank: ${recipe.freezerDays} Tage` : null,
                recipe.reheatTips ? `Aufwärm-Tipps: ${recipe.reheatTips}` : null,
                recipe.batchNotes ? `Batch-Notizen: ${recipe.batchNotes}` : null
            ].filter(Boolean);
            return parts.join(' • ');
        }).join('\n');

        const prompt = `Du bist ein erfahrener Meal-Prep Coach. Plane effiziente Meal-Prep Sessions für den ${prepDayLabel}.\n\n` +
            `Vorhandene Rezepte:\n${recipeSummaries}\n\n` +
            `Ziele:\n` +
            `- Ordne die Rezepte in produktive Sessions, die parallelisierbar sind.\n` +
            `- Gib Hinweise zur optimalen Reihenfolge und wann Aufgaben parallel laufen können.\n` +
            `- Berücksichtige vorhandene Haltbarkeitsdaten und Aufwärmhinweise.\n` +
            `- Gruppiere Zutaten für gemeinsames Vorbereiten.\n\n` +
            `Liefere ausschließlich ein valides JSON ohne zusätzlichen Text im Format:\n` +
            `{\n` +
            `  "sessions": [{\n` +
            `    "label": "string",\n` +
            `    "recommendedStartTime": "string",\n` +
            `    "estimatedTotalMinutes": number,\n` +
            `    "recipes": [{\n` +
            `      "recipeId": "ID von oben",\n` +
            `      "name": "string",\n` +
            `      "batchPortions": number,\n` +
            `      "prepOrder": number,\n` +
            `      "parallelizationTips": "string",\n` +
            `      "storage": {\n` +
            `        "fridgeDays": number|null,\n` +
            `        "freezerDays": number|null,\n` +
            `        "notes": "string"\n` +
            `      },\n` +
            `      "reheatTips": "string",\n` +
            `      "targetDates": ["YYYY-MM-DD", ...]\n` +
            `    }],\n` +
            `    "timeline": [{\n` +
            `      "start": "HH:MM",\n` +
            `      "end": "HH:MM",\n` +
            `      "task": "string",\n` +
            `      "relatedRecipeIds": ["ID", ...]\n` +
            `    }],\n` +
            `    "cleanupTips": ["string", ...]\n` +
            `  }],\n` +
            `  "shoppingGroups": [{\n` +
            `    "label": "string",\n` +
            `    "ingredients": [{\n` +
            `      "name": "string",\n` +
            `      "unit": "string",\n` +
            `      "totalAmount": number|string,\n` +
            `      "recipes": ["ID", ...]\n` +
            `    }]\n` +
            `  }],\n` +
            `  "generalAdvice": ["string", ...]\n` +
            `}\n\n` +
            `Nutze ausschließlich die vorhandenen Rezept-IDs. Verwende keine Markdown-Codeblöcke.`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        let jsonText = response.text().trim();

        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?$/g, '').trim();
        }

        const suggestions = JSON.parse(jsonText);

        if (!suggestions.sessions || !Array.isArray(suggestions.sessions)) {
            throw new Error('Invalid AI response: sessions missing');
        }

        logger.info('Meal-prep suggestions generated', {
            recipeCount: eligibleRecipes.length,
            requestId: req.requestId,
            component: 'ai'
        });

        res.json({
            sessions: suggestions.sessions,
            shoppingGroups: Array.isArray(suggestions.shoppingGroups) ? suggestions.shoppingGroups : [],
            generalAdvice: Array.isArray(suggestions.generalAdvice) ? suggestions.generalAdvice : [],
            metadata: {
                generatedAt: new Date().toISOString(),
                recipeCount: eligibleRecipes.length,
                prepDay: prepDayLabel
            }
        });
    } catch (error) {
        logger.error('Meal-prep suggestion error', {
            error: error.message,
            requestId: req.requestId,
            component: 'ai'
        });

        if (error instanceof SyntaxError) {
            return res.status(500).json({
                error: 'Die KI-Antwort konnte nicht verarbeitet werden. Bitte versuche es erneut.',
                details: 'JSON parsing failed'
            });
        }

        res.status(500).json({
            error: 'Fehler bei der Meal-Prep Empfehlung',
            details: error.message
        });
    }
});

// Start server with migrations
const startServer = async () => {
    try {
        // Run migrations before starting the server
        await db.runMigrations();

        app.listen(PORT, '0.0.0.0', () => {
            logger.info('Food Planner Backend started', { port: PORT, component: 'server' });
        });
    } catch (error) {
        logger.error('Failed to start server', { error: error.message, component: 'server' });
        process.exit(1);
    }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing database...', { component: 'server' });
    await db.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, closing database...', { component: 'server' });
    await db.close();
    process.exit(0);
});
