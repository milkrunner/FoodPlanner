const express = require('express');
const router = express.Router();
const { SEASONAL_CALENDAR, getCurrentSeason, isIngredientInSeason } = require('../utils/seasonal');
const { authenticateRequired } = require('../middleware/authenticate');

// Get current season info and calendar
router.get('/', authenticateRequired, (req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
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
router.get('/:season/ingredients', authenticateRequired, (req, res) => {
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
router.post('/check', authenticateRequired, (req, res) => {
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

module.exports = router;
