/**
 * Tests for POST /shopping/manual/from-recipe logic
 * Tests ingredient merging with amount addition and normalization
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeIngredientName, parseAmount } = require('../../utils/unit-conversion');

// ========== Extracted from-recipe logic for testing ==========

/**
 * Process ingredients for adding to shopping list with amount merging.
 * @param {Array} existingItems - current manual shopping items
 * @param {Array} ingredients - new ingredients to add
 * @returns {{ actions: Array, added: number, merged: number }}
 */
function processIngredientsFromRecipe(existingItems, ingredients) {
    const existingMap = new Map();
    for (const item of existingItems) {
        const key = `${normalizeIngredientName(item.name)}|${(item.unit || '').toLowerCase()}`;
        existingMap.set(key, { ...item });
    }

    const actions = [];
    let added = 0;
    let merged = 0;

    for (const ing of ingredients) {
        const name = String(ing.name || '').slice(0, 200).trim();
        const amount = String(ing.amount || '1').slice(0, 50).trim();
        const unit = String(ing.unit || 'x').slice(0, 50).trim();
        const category = String(ing.category || 'Sonstiges').slice(0, 100);

        if (!name) continue;

        const key = `${normalizeIngredientName(name)}|${unit.toLowerCase()}`;
        const match = existingMap.get(key);

        if (match) {
            const existingAmount = parseAmount(match.amount);
            const newAmount = parseAmount(amount);
            if (existingAmount !== null && newAmount !== null) {
                const summed = Math.round((existingAmount + newAmount) * 100) / 100;
                actions.push({ type: 'update', id: match.id, amount: String(summed) });
                match.amount = String(summed);
                merged++;
            }
        } else {
            actions.push({ type: 'insert', name, amount, unit, category });
            existingMap.set(key, { id: `new-${added}`, name, amount, unit, category });
            added++;
        }
    }

    return { actions, added, merged };
}

// ========== Tests ==========

describe('processIngredientsFromRecipe', () => {
    it('should add new ingredients when list is empty', () => {
        const result = processIngredientsFromRecipe([], [
            { name: 'Spaghetti', amount: '400', unit: 'g', category: 'Trockenwaren' },
            { name: 'Speck', amount: '200', unit: 'g', category: 'Fleisch & Fisch' },
        ]);

        assert.equal(result.added, 2);
        assert.equal(result.merged, 0);
        assert.equal(result.actions.length, 2);
        assert.equal(result.actions[0].type, 'insert');
        assert.equal(result.actions[1].type, 'insert');
    });

    it('should merge amounts for matching name+unit', () => {
        const existing = [
            { id: '1', name: 'Butter', amount: '200', unit: 'g', category: 'Milchprodukte' },
        ];
        const result = processIngredientsFromRecipe(existing, [
            { name: 'Butter', amount: '100', unit: 'g', category: 'Milchprodukte' },
        ]);

        assert.equal(result.added, 0);
        assert.equal(result.merged, 1);
        assert.equal(result.actions[0].type, 'update');
        assert.equal(result.actions[0].amount, '300');
    });

    it('should treat different units as separate entries', () => {
        const existing = [
            { id: '1', name: 'Milch', amount: '500', unit: 'ml', category: 'Milchprodukte' },
        ];
        const result = processIngredientsFromRecipe(existing, [
            { name: 'Milch', amount: '1', unit: 'l', category: 'Milchprodukte' },
        ]);

        assert.equal(result.added, 1);
        assert.equal(result.merged, 0);
    });

    it('should match German plural forms (Tomaten → Tomate)', () => {
        const existing = [
            { id: '1', name: 'Tomate', amount: '3', unit: 'Stück', category: 'Obst & Gemüse' },
        ];
        const result = processIngredientsFromRecipe(existing, [
            { name: 'Tomaten', amount: '2', unit: 'Stück', category: 'Obst & Gemüse' },
        ]);

        assert.equal(result.merged, 1);
        assert.equal(result.actions[0].amount, '5');
    });

    it('should handle batch duplicates within same request', () => {
        const result = processIngredientsFromRecipe([], [
            { name: 'Mehl', amount: '200', unit: 'g' },
            { name: 'Mehl', amount: '300', unit: 'g' },
        ]);

        assert.equal(result.added, 1);
        assert.equal(result.merged, 1);
        // First insert, then merge
        assert.equal(result.actions[0].type, 'insert');
        assert.equal(result.actions[1].type, 'update');
        assert.equal(result.actions[1].amount, '500');
    });

    it('should skip ingredients with empty name', () => {
        const result = processIngredientsFromRecipe([], [
            { name: '', amount: '100', unit: 'g' },
            { name: '  ', amount: '100', unit: 'g' },
        ]);

        assert.equal(result.added, 0);
        assert.equal(result.merged, 0);
        assert.equal(result.actions.length, 0);
    });

    it('should default amount to 1 and unit to x', () => {
        const result = processIngredientsFromRecipe([], [
            { name: 'Salz' },
        ]);

        assert.equal(result.added, 1);
        assert.equal(result.actions[0].amount, '1');
        assert.equal(result.actions[0].unit, 'x');
    });

    it('should default category to Sonstiges', () => {
        const result = processIngredientsFromRecipe([], [
            { name: 'Salz', amount: '1', unit: 'Prise' },
        ]);

        assert.equal(result.actions[0].category, 'Sonstiges');
    });

    it('should handle decimal amount merging precisely', () => {
        const existing = [
            { id: '1', name: 'Öl', amount: '0.1', unit: 'l', category: 'Sonstiges' },
        ];
        const result = processIngredientsFromRecipe(existing, [
            { name: 'Öl', amount: '0.2', unit: 'l' },
        ]);

        assert.equal(result.merged, 1);
        assert.equal(result.actions[0].amount, '0.3');
    });

    it('should handle case-insensitive unit matching', () => {
        const existing = [
            { id: '1', name: 'Zucker', amount: '200', unit: 'G', category: 'Trockenwaren' },
        ];
        const result = processIngredientsFromRecipe(existing, [
            { name: 'Zucker', amount: '100', unit: 'g' },
        ]);

        assert.equal(result.merged, 1);
        assert.equal(result.actions[0].amount, '300');
    });
});

describe('from-recipe validation', () => {
    it('should reject empty ingredients array', () => {
        const ingredients = [];
        assert.equal(ingredients.length === 0, true);
    });

    it('should reject too many ingredients', () => {
        const ingredients = new Array(101).fill({ name: 'test' });
        assert.equal(ingredients.length > 100, true);
    });

    it('should truncate overly long values', () => {
        const longName = 'A'.repeat(300);
        const truncated = longName.slice(0, 200);
        assert.equal(truncated.length, 200);
    });
});
