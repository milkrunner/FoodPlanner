const express = require('express');
const router = express.Router();
const crypto = require('node:crypto');
const db = require('../db');
const { logger } = require('../utils/logger');
const { resolveFavoriteFlagFromBody, resolveToggleTarget } = require('../utils/favorites');
const { buildRecipeQuery } = require('../utils/recipe-queries');
const { parseNullableInt, parseNullableText, parseBooleanFlag } = require('../utils/parsing');
const { SEASONAL_CALENDAR, getCurrentSeason, isIngredientInSeason, calculateSeasonalScore } = require('../utils/seasonal');
const { authenticateRequired } = require('../middleware/authenticate');
const { validate } = require('../middleware/validate');
const { createRecipeSchema } = require('../schemas/recipes');

// Default pagination settings
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Get all recipes - Optimized with single JOIN query and pagination
// Query params: page (default: 1), pageSize (default: 20, max: 100), all (if true, returns all recipes)
router.get('/', authenticateRequired, async (req, res) => {
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
        const query = buildRecipeQuery({
            where: favoritesOnly ? 'r.is_favorite = TRUE' : undefined,
        }) + (returnAll ? '' : ' LIMIT $1 OFFSET $2');

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
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Get recipes filtered by season (recipes with seasonal ingredients)
// NOTE: This route must be defined BEFORE /:id to avoid "seasonal" being matched as an ID
router.get('/seasonal', authenticateRequired, async (req, res) => {
    try {
        const { season, minScore, limit, offset } = req.query;
        const minimumScore = parseInt(minScore) || 30;
        const pageLimit = Math.min(parseInt(limit) || 50, 100);
        const pageOffset = Math.max(parseInt(offset) || 0, 0);
        const currentSeason = getCurrentSeason();
        const seasonKey = season || currentSeason.key;

        const { rows } = await db.query(buildRecipeQuery({ columns: 'summary' }));

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

        const paginatedRecipes = seasonalRecipes.slice(pageOffset, pageOffset + pageLimit);

        res.json({
            season: SEASONAL_CALENDAR[seasonKey].name,
            seasonKey,
            minimumScore,
            totalRecipes: rows.length,
            seasonalRecipes: seasonalRecipes.length,
            limit: pageLimit,
            offset: pageOffset,
            recipes: paginatedRecipes
        });
    } catch (error) {
        logger.error('Error fetching seasonal recipes', { error: error.message, requestId: req.requestId, component: 'seasons' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Get seasonal recommendations for the start page
router.get('/seasonal/recommendations', authenticateRequired, async (req, res) => {
    try {
        const { limit } = req.query;
        const maxResults = Math.min(parseInt(limit) || 6, 20);
        const currentSeason = getCurrentSeason();

        const { rows } = await db.query(buildRecipeQuery({ columns: 'summary' }));

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
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Get recipe by ID - Optimized with single JOIN query
router.get('/:id', authenticateRequired, async (req, res) => {
    try {
        const startTime = Date.now();

        // Single query with JSON aggregation - replaces 3 separate queries
        const { rows } = await db.query(buildRecipeQuery({ where: 'r.id = $1' }), [req.params.id]);

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
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Create recipe
router.post('/', authenticateRequired, validate(createRecipeSchema), async (req, res) => {
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
    const id = crypto.randomUUID();
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

            // Batch insert ingredients
            if (ingredients && ingredients.length > 0) {
                const ingValues = [];
                const ingParams = [];
                ingredients.forEach((ing, i) => {
                    const offset = i * 5;
                    ingValues.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
                    ingParams.push(id, ing.name, ing.amount, ing.unit, ing.category || 'Sonstiges');
                });
                await client.query(
                    `INSERT INTO ingredients (recipe_id, name, amount, unit, category) VALUES ${ingValues.join(', ')}`,
                    ingParams
                );
            }

            // Batch insert tags
            if (tags && tags.length > 0) {
                const tagValues = [];
                const tagParams = [];
                tags.forEach((tag, i) => {
                    const offset = i * 2;
                    tagValues.push(`($${offset + 1}, $${offset + 2})`);
                    tagParams.push(id, tag);
                });
                await client.query(
                    `INSERT INTO recipe_tags (recipe_id, tag) VALUES ${tagValues.join(', ')}`,
                    tagParams
                );
            }
        });

        res.status(201).json({ id, is_favorite: favoriteValue, message: 'Recipe created successfully' });
    } catch (error) {
        logger.error('Error creating recipe', { error: error.message, requestId: req.requestId, component: 'recipes' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Update recipe
router.put('/:id', authenticateRequired, validate(createRecipeSchema), async (req, res) => {
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
                const ingValues = [];
                const ingParams = [];
                ingredients.forEach((ing, i) => {
                    const offset = i * 5;
                    ingValues.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
                    ingParams.push(req.params.id, ing.name, ing.amount, ing.unit, ing.category || 'Sonstiges');
                });
                await client.query(
                    `INSERT INTO ingredients (recipe_id, name, amount, unit, category) VALUES ${ingValues.join(', ')}`,
                    ingParams
                );
            }

            // Delete old tags and insert new ones
            await client.query('DELETE FROM recipe_tags WHERE recipe_id = $1', [req.params.id]);

            if (tags && tags.length > 0) {
                const tagValues = [];
                const tagParams = [];
                tags.forEach((tag, i) => {
                    const offset = i * 2;
                    tagValues.push(`($${offset + 1}, $${offset + 2})`);
                    tagParams.push(req.params.id, tag);
                });
                await client.query(
                    `INSERT INTO recipe_tags (recipe_id, tag) VALUES ${tagValues.join(', ')}`,
                    tagParams
                );
            }
        });

        res.json({ message: 'Recipe updated successfully', is_favorite: updatedFavorite });
    } catch (error) {
        logger.error('Error updating recipe', { error: error.message, recipeId: req.params.id, requestId: req.requestId, component: 'recipes' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Toggle favorite status
router.put('/:id/favorite', authenticateRequired, async (req, res) => {
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
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Delete recipe
router.delete('/:id', authenticateRequired, async (req, res) => {
    try {
        await db.query('DELETE FROM recipes WHERE id = $1', [req.params.id]);
        res.json({ message: 'Recipe deleted successfully' });
    } catch (error) {
        logger.error('Error deleting recipe', { error: error.message, recipeId: req.params.id, requestId: req.requestId, component: 'recipes' });
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

module.exports = router;
