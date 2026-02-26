/**
 * Shared recipe query fragments to avoid duplication across endpoints.
 */

const RECIPE_COLUMNS_FULL = `
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
    r.updated_at`;

const RECIPE_COLUMNS_SUMMARY = `
    r.id,
    r.name,
    r.category,
    r.servings,
    r.is_favorite,
    r.created_at`;

const INGREDIENTS_AGG = `
    COALESCE(
        json_agg(DISTINCT jsonb_build_object(
            'name', i.name,
            'amount', i.amount,
            'unit', i.unit,
            'category', i.category
        )) FILTER (WHERE i.name IS NOT NULL),
        '[]'::json
    ) as ingredients`;

const TAGS_AGG = `
    COALESCE(
        json_agg(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL),
        '[]'::json
    ) as tags`;

const RECIPE_JOINS = `
    FROM recipes r
    LEFT JOIN ingredients i ON r.id = i.recipe_id
    LEFT JOIN recipe_tags t ON r.id = t.recipe_id`;

/**
 * Build a recipe query with standard joins and aggregation.
 * @param {object} options
 * @param {string} [options.columns='full'] - 'full' or 'summary'
 * @param {string} [options.where] - WHERE clause (without WHERE keyword)
 * @param {string} [options.groupBy] - GROUP BY clause (without GROUP BY keyword), defaults to matching columns
 * @param {string} [options.orderBy='r.created_at DESC'] - ORDER BY clause
 * @param {string} [options.limit] - LIMIT clause
 * @param {string} [options.offset] - OFFSET clause
 */
function buildRecipeQuery(options = {}) {
    const cols = options.columns === 'summary' ? RECIPE_COLUMNS_SUMMARY : RECIPE_COLUMNS_FULL;
    const groupCols = options.columns === 'summary'
        ? 'r.id, r.name, r.category, r.servings, r.is_favorite, r.created_at'
        : 'r.id, r.name, r.category, r.servings, r.instructions, r.is_favorite, r.prep_time, r.cook_time, r.difficulty, r.created_at, r.updated_at';

    let query = `SELECT ${cols}, ${INGREDIENTS_AGG}, ${TAGS_AGG} ${RECIPE_JOINS}`;

    if (options.where) {
        query += ` WHERE ${options.where}`;
    }

    query += ` GROUP BY ${options.groupBy || groupCols}`;
    query += ` ORDER BY ${options.orderBy || 'r.created_at DESC'}`;

    if (options.limit) {
        query += ` LIMIT ${options.limit}`;
    }
    if (options.offset) {
        query += ` OFFSET ${options.offset}`;
    }

    return query;
}

module.exports = { buildRecipeQuery, RECIPE_JOINS, INGREDIENTS_AGG, TAGS_AGG };
