/**
 * Integration tests for Shopping List operations.
 * Tests: Manual items CRUD, from-recipe ingredient merging, clear all.
 *
 * Requires a running test PostgreSQL (docker-compose.test.yml).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { runMigrations, resetDatabase, startApp, teardown, request } = require('./setup');

describe('Shopping List Integration', () => {
    let baseUrl, server, authToken;

    before(async () => {
        await resetDatabase();
        await runMigrations();
        ({ baseUrl, server } = await startApp());

        const res = await request(baseUrl, 'POST', '/auth/register', {
            body: { email: 'shopper@example.com', password: 'ShopPass123', name: 'Shopper' }
        });
        authToken = res.data.token;
    });

    after(async () => {
        await teardown(server);
    });

    const authHeaders = () => ({ 'Authorization': `Bearer ${authToken}` });

    describe('Manual shopping items', () => {
        let itemId;

        it('should add a manual item', async () => {
            const res = await request(baseUrl, 'POST', '/shopping/manual', {
                body: { id: 'item-1', name: 'Butter', amount: '250', unit: 'g', category: 'Milchprodukte' },
                headers: authHeaders()
            });
            assert.strictEqual(res.status, 201);
            itemId = 'item-1';
        });

        it('should list manual items', async () => {
            const res = await request(baseUrl, 'GET', '/shopping/manual', {
                headers: authHeaders()
            });
            assert.strictEqual(res.status, 200);
            assert.ok(Array.isArray(res.data));
            assert.strictEqual(res.data.length, 1);
            assert.strictEqual(res.data[0].name, 'Butter');
        });

        it('should reject item without name', async () => {
            const res = await request(baseUrl, 'POST', '/shopping/manual', {
                body: { id: 'item-bad', name: '', amount: '1', unit: 'Stück' },
                headers: authHeaders()
            });
            assert.strictEqual(res.status, 400);
        });

        it('should delete a single item', async () => {
            const res = await request(baseUrl, 'DELETE', `/shopping/manual/${itemId}`, {
                body: {},
                headers: authHeaders()
            });
            assert.strictEqual(res.status, 200);

            // Verify empty list
            const list = await request(baseUrl, 'GET', '/shopping/manual', {
                headers: authHeaders()
            });
            assert.strictEqual(list.data.length, 0);
        });
    });

    describe('POST /shopping/manual/from-recipe', () => {
        it('should add ingredients from a recipe', async () => {
            const res = await request(baseUrl, 'POST', '/shopping/manual/from-recipe', {
                body: {
                    ingredients: [
                        { name: 'Mehl', amount: '500', unit: 'g', category: 'Trockenwaren' },
                        { name: 'Eier', amount: '3', unit: 'Stück', category: 'Sonstiges' }
                    ]
                },
                headers: authHeaders()
            });
            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.data.added, 2);
            assert.strictEqual(res.data.merged, 0);
        });

        it('should merge amounts for duplicate ingredients', async () => {
            const res = await request(baseUrl, 'POST', '/shopping/manual/from-recipe', {
                body: {
                    ingredients: [
                        { name: 'Mehl', amount: '200', unit: 'g', category: 'Trockenwaren' }
                    ]
                },
                headers: authHeaders()
            });
            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.data.merged, 1);
            assert.strictEqual(res.data.added, 0);

            // Verify merged amount (500 + 200 = 700)
            const list = await request(baseUrl, 'GET', '/shopping/manual', {
                headers: authHeaders()
            });
            const mehl = list.data.find(i => i.name.toLowerCase().includes('mehl'));
            assert.ok(mehl, 'Mehl should exist');
            assert.strictEqual(parseFloat(mehl.amount), 700);
        });

        it('should reject empty ingredients array', async () => {
            const res = await request(baseUrl, 'POST', '/shopping/manual/from-recipe', {
                body: { ingredients: [] },
                headers: authHeaders()
            });
            assert.strictEqual(res.status, 400);
        });
    });

    describe('DELETE /shopping/manual (clear all)', () => {
        it('should delete all items', async () => {
            const res = await request(baseUrl, 'DELETE', '/shopping/manual', {
                body: {},
                headers: authHeaders()
            });
            assert.strictEqual(res.status, 200);

            const list = await request(baseUrl, 'GET', '/shopping/manual', {
                headers: authHeaders()
            });
            assert.strictEqual(list.data.length, 0);
        });
    });
});
