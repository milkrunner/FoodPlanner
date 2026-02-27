/**
 * Classic keyword-based recipe search (fallback when AI is unavailable)
 */

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

module.exports = { classicSearch };
