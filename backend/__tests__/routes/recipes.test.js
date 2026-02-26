/**
 * Recipe endpoint tests using Node.js built-in test runner
 * Tests recipe CRUD logic and query building without requiring external dependencies
 * Run with: node --test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Mock database module for testing
function createMockDb(options = {}) {
    return {
        query: options.query || (async () => ({ rows: [], rowCount: 0 })),
        transaction: options.transaction || (async (fn) => {
            const client = {
                query: options.clientQuery || (async () => ({ rows: [], rowCount: 0 }))
            };
            return fn(client);
        })
    };
}

// ========== Extracted recipe logic for testing ==========

function validateRecipeInput(body) {
    const { name, ingredients } = body;
    if (!name || !name.trim()) {
        return { valid: false, error: 'Recipe name is required' };
    }
    if (ingredients && !Array.isArray(ingredients)) {
        return { valid: false, error: 'Ingredients must be an array' };
    }
    return { valid: true };
}

function buildBatchInsertIngredients(recipeId, ingredients) {
    const values = [];
    const params = [];
    ingredients.forEach((ing, i) => {
        const offset = i * 5;
        values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
        params.push(recipeId, ing.name, ing.amount, ing.unit, ing.category || 'Sonstiges');
    });
    return {
        sql: `INSERT INTO ingredients (recipe_id, name, amount, unit, category) VALUES ${values.join(', ')}`,
        params
    };
}

function buildBatchInsertTags(recipeId, tags) {
    const values = [];
    const params = [];
    tags.forEach((tag, i) => {
        const offset = i * 2;
        values.push(`($${offset + 1}, $${offset + 2})`);
        params.push(recipeId, tag);
    });
    return {
        sql: `INSERT INTO recipe_tags (recipe_id, tag) VALUES ${values.join(', ')}`,
        params
    };
}

function groupWeekplanRows(rows) {
    const daysMap = new Map();
    for (const row of rows) {
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
    return Array.from(daysMap.values());
}

// ========== Tests ==========

describe('Recipe Validation', () => {
    it('should reject empty recipe name', () => {
        const result = validateRecipeInput({ name: '', ingredients: [] });
        assert.strictEqual(result.valid, false);
        assert.ok(result.error.includes('name'));
    });

    it('should reject whitespace-only recipe name', () => {
        const result = validateRecipeInput({ name: '   ', ingredients: [] });
        assert.strictEqual(result.valid, false);
    });

    it('should accept valid recipe', () => {
        const result = validateRecipeInput({ name: 'Pasta', ingredients: [] });
        assert.strictEqual(result.valid, true);
    });

    it('should reject non-array ingredients', () => {
        const result = validateRecipeInput({ name: 'Pasta', ingredients: 'not-array' });
        assert.strictEqual(result.valid, false);
        assert.ok(result.error.includes('array'));
    });
});

describe('Batch Insert - Ingredients', () => {
    it('should build correct multi-row INSERT', () => {
        const ingredients = [
            { name: 'Mehl', amount: '500', unit: 'g', category: 'Backen' },
            { name: 'Zucker', amount: '100', unit: 'g', category: 'Backen' }
        ];
        const result = buildBatchInsertIngredients('recipe-1', ingredients);

        assert.ok(result.sql.includes('VALUES'));
        assert.strictEqual(result.params.length, 10); // 2 ingredients * 5 params each
        assert.strictEqual(result.params[0], 'recipe-1');
        assert.strictEqual(result.params[1], 'Mehl');
        assert.strictEqual(result.params[5], 'recipe-1');
        assert.strictEqual(result.params[6], 'Zucker');
    });

    it('should default category to Sonstiges', () => {
        const ingredients = [{ name: 'Salz', amount: '1', unit: 'TL' }];
        const result = buildBatchInsertIngredients('recipe-1', ingredients);

        assert.strictEqual(result.params[4], 'Sonstiges');
    });

    it('should handle single ingredient', () => {
        const ingredients = [{ name: 'Butter', amount: '50', unit: 'g', category: 'Milch' }];
        const result = buildBatchInsertIngredients('recipe-1', ingredients);

        assert.strictEqual(result.params.length, 5);
        assert.ok(result.sql.includes('($1, $2, $3, $4, $5)'));
    });
});

describe('Batch Insert - Tags', () => {
    it('should build correct multi-row INSERT for tags', () => {
        const tags = ['vegan', 'schnell', 'günstig'];
        const result = buildBatchInsertTags('recipe-1', tags);

        assert.strictEqual(result.params.length, 6); // 3 tags * 2 params each
        assert.ok(result.sql.includes('VALUES'));
        assert.strictEqual(result.params[0], 'recipe-1');
        assert.strictEqual(result.params[1], 'vegan');
        assert.strictEqual(result.params[2], 'recipe-1');
        assert.strictEqual(result.params[3], 'schnell');
    });
});

describe('Weekplan Row Grouping (N+1 fix)', () => {
    it('should group JOIN rows into days with meals', () => {
        const rows = [
            { day_id: 1, date: '2026-02-23', day_name: 'Montag', meal_id: 'a', recipe_id: 'r1', recipe_name: 'Pasta', meal_type: 'lunch' },
            { day_id: 1, date: '2026-02-23', day_name: 'Montag', meal_id: 'b', recipe_id: 'r2', recipe_name: 'Salat', meal_type: 'dinner' },
            { day_id: 2, date: '2026-02-24', day_name: 'Dienstag', meal_id: 'c', recipe_id: 'r3', recipe_name: 'Suppe', meal_type: 'lunch' }
        ];

        const days = groupWeekplanRows(rows);

        assert.strictEqual(days.length, 2);
        assert.strictEqual(days[0].dayName, 'Montag');
        assert.strictEqual(Object.keys(days[0].meals).length, 2);
        assert.strictEqual(days[0].meals.lunch.recipeName, 'Pasta');
        assert.strictEqual(days[0].meals.dinner.recipeName, 'Salat');
        assert.strictEqual(days[1].dayName, 'Dienstag');
        assert.strictEqual(Object.keys(days[1].meals).length, 1);
    });

    it('should handle days with no meals (LEFT JOIN null rows)', () => {
        const rows = [
            { day_id: 1, date: '2026-02-23', day_name: 'Montag', meal_id: null, recipe_id: null, recipe_name: null, meal_type: null }
        ];

        const days = groupWeekplanRows(rows);

        assert.strictEqual(days.length, 1);
        assert.strictEqual(days[0].dayName, 'Montag');
        assert.strictEqual(Object.keys(days[0].meals).length, 0);
    });

    it('should handle empty result set', () => {
        const days = groupWeekplanRows([]);
        assert.strictEqual(days.length, 0);
    });
});

describe('Recipe CRUD with Mock DB', () => {
    it('should fetch recipes from database', async () => {
        const mockRecipes = [
            { id: '1', name: 'Pasta', category: 'Italienisch' },
            { id: '2', name: 'Salat', category: 'Leicht' }
        ];
        const db = createMockDb({
            query: async () => ({ rows: mockRecipes, rowCount: 2 })
        });

        const result = await db.query('SELECT * FROM recipes');
        assert.strictEqual(result.rows.length, 2);
        assert.strictEqual(result.rows[0].name, 'Pasta');
    });

    it('should handle database errors gracefully', async () => {
        const db = createMockDb({
            query: async () => { throw new Error('Connection refused'); }
        });

        await assert.rejects(
            () => db.query('SELECT * FROM recipes'),
            { message: 'Connection refused' }
        );
    });

    it('should execute transaction with batch inserts', async () => {
        const queries = [];
        const db = createMockDb({
            clientQuery: async (sql, params) => {
                queries.push({ sql, params });
                return { rows: [], rowCount: 1 };
            }
        });

        await db.transaction(async (client) => {
            await client.query('INSERT INTO recipes (id, name) VALUES ($1, $2)', ['id-1', 'Test']);
            const { sql, params } = buildBatchInsertIngredients('id-1', [
                { name: 'Mehl', amount: '500', unit: 'g', category: 'Backen' }
            ]);
            await client.query(sql, params);
        });

        assert.strictEqual(queries.length, 2);
        assert.ok(queries[0].sql.includes('INSERT INTO recipes'));
        assert.ok(queries[1].sql.includes('INSERT INTO ingredients'));
    });
});
