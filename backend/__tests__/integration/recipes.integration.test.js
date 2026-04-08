/**
 * Integration tests for Recipe CRUD operations.
 * Tests: Create → Read → Update → Favorite → Delete
 *
 * Requires a running test PostgreSQL (docker-compose.test.yml).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { runMigrations, resetDatabase, startApp, teardown, request } = require('./setup');

describe('Recipes Integration', () => {
    let baseUrl, server, authToken, createdRecipeId;

    before(async () => {
        await resetDatabase();
        await runMigrations();
        ({ baseUrl, server } = await startApp());

        // Register a test user and get auth token
        const res = await request(baseUrl, 'POST', '/auth/register', {
            body: { email: 'chef@example.com', password: 'ChefPass123', name: 'Chef' }
        });
        authToken = res.data.token;
    });

    after(async () => {
        await teardown(server);
    });

    const authHeaders = () => ({ 'Authorization': `Bearer ${authToken}` });

    const sampleRecipe = {
        name: 'Spaghetti Carbonara',
        category: 'Hauptgericht',
        servings: 4,
        instructions: 'Schritt 1: Nudeln kochen. Schritt 2: Speck anbraten. Schritt 3: Eier-Käse-Mischung.',
        ingredients: [
            { name: 'Spaghetti', amount: '400', unit: 'g', category: 'Trockenwaren' },
            { name: 'Speck', amount: '200', unit: 'g', category: 'Fleisch & Fisch' },
            { name: 'Eier', amount: '4', unit: 'Stück', category: 'Sonstiges' },
            { name: 'Parmesan', amount: '100', unit: 'g', category: 'Milchprodukte' }
        ],
        tags: ['schnell', 'günstig']
    };

    describe('POST /recipes', () => {
        it('should create a recipe with ingredients and tags', async () => {
            const res = await request(baseUrl, 'POST', '/recipes', {
                body: sampleRecipe,
                headers: authHeaders()
            });
            assert.strictEqual(res.status, 201);
            assert.ok(res.data.id, 'should return recipe ID');
            createdRecipeId = res.data.id;
        });

        it('should reject recipe without name', async () => {
            const res = await request(baseUrl, 'POST', '/recipes', {
                body: { ...sampleRecipe, name: '' },
                headers: authHeaders()
            });
            assert.strictEqual(res.status, 400);
        });

        it('should reject unauthenticated request', async () => {
            const res = await request(baseUrl, 'POST', '/recipes', {
                body: sampleRecipe
            });
            assert.strictEqual(res.status, 401);
        });
    });

    describe('GET /recipes', () => {
        it('should list recipes with pagination', async () => {
            const res = await request(baseUrl, 'GET', '/recipes', {
                headers: authHeaders()
            });
            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.data.recipes), 'should return array in recipes field');
            assert.ok(res.data.recipes.length >= 1, 'should have at least one recipe');
            assert.ok(res.data.pagination, 'should include pagination metadata');
        });
    });

    describe('GET /recipes/:id', () => {
        it('should return recipe with ingredients and tags', async () => {
            const res = await request(baseUrl, 'GET', `/recipes/${createdRecipeId}`, {
                headers: authHeaders()
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.name, 'Spaghetti Carbonara');
            assert.strictEqual(res.data.servings, 4);
            assert.ok(Array.isArray(res.data.ingredients), 'should include ingredients');
            assert.strictEqual(res.data.ingredients.length, 4);
            assert.ok(Array.isArray(res.data.tags), 'should include tags');
            assert.strictEqual(res.data.tags.length, 2);
        });

        it('should return 404 for non-existent recipe', async () => {
            const res = await request(baseUrl, 'GET', '/recipes/non-existent-id', {
                headers: authHeaders()
            });
            assert.strictEqual(res.status, 404);
        });
    });

    describe('PUT /recipes/:id', () => {
        it('should update recipe name and ingredients', async () => {
            const updated = {
                ...sampleRecipe,
                name: 'Spaghetti Carbonara Deluxe',
                servings: 6,
                ingredients: [
                    ...sampleRecipe.ingredients,
                    { name: 'Sahne', amount: '100', unit: 'ml', category: 'Milchprodukte' }
                ]
            };
            const res = await request(baseUrl, 'PUT', `/recipes/${createdRecipeId}`, {
                body: updated,
                headers: authHeaders()
            });
            assert.strictEqual(res.status, 200);

            // Verify changes persisted
            const get = await request(baseUrl, 'GET', `/recipes/${createdRecipeId}`, {
                headers: authHeaders()
            });
            assert.strictEqual(get.data.name, 'Spaghetti Carbonara Deluxe');
            assert.strictEqual(get.data.servings, 6);
            assert.strictEqual(get.data.ingredients.length, 5);
        });
    });

    describe('PUT /recipes/:id/favorite', () => {
        it('should toggle favorite status', async () => {
            const res = await request(baseUrl, 'PUT', `/recipes/${createdRecipeId}/favorite`, {
                body: {},
                headers: authHeaders()
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.is_favorite, true);

            // Toggle back
            const res2 = await request(baseUrl, 'PUT', `/recipes/${createdRecipeId}/favorite`, {
                body: {},
                headers: authHeaders()
            });
            assert.strictEqual(res2.data.is_favorite, false);
        });
    });

    describe('DELETE /recipes/:id', () => {
        it('should delete a recipe', async () => {
            const res = await request(baseUrl, 'DELETE', `/recipes/${createdRecipeId}`, {
                body: {},
                headers: authHeaders()
            });
            assert.strictEqual(res.status, 200);

            // Verify deleted
            const get = await request(baseUrl, 'GET', `/recipes/${createdRecipeId}`, {
                headers: authHeaders()
            });
            assert.strictEqual(get.status, 404);
        });
    });
});
