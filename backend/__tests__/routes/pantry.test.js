/**
 * Pantry endpoint tests using Node.js built-in test runner
 * Tests pantry CRUD logic and validation without requiring external dependencies
 * Run with: node --test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Mock database module for testing
function createMockDb(options = {}) {
    return {
        query: options.query || (async () => ({ rows: [] }))
    };
}

// ========== Extracted pantry logic for testing ==========

async function getAllPantryItems(db) {
    try {
        const result = await db.query(
            'SELECT * FROM pantry_items ORDER BY expiry_date ASC NULLS LAST, name ASC'
        );
        return { status: 200, body: result.rows };
    } catch (error) {
        return { status: 500, body: { error: 'Failed to fetch pantry items' } };
    }
}

async function getExpiringItems(db, days) {
    const parsedDays = parseInt(days) || 3;
    try {
        const result = await db.query(
            `SELECT * FROM pantry_items
             WHERE expiry_date IS NOT NULL
               AND expiry_date <= CURRENT_DATE + $1 * INTERVAL '1 day'
             ORDER BY expiry_date ASC`,
            [parsedDays]
        );
        return { status: 200, body: result.rows };
    } catch (error) {
        return { status: 500, body: { error: 'Failed to fetch expiring pantry items' } };
    }
}

function validatePantryInput(body) {
    const { name } = body;
    if (!name || !name.trim()) {
        return { valid: false, error: 'Name ist erforderlich' };
    }
    return { valid: true };
}

async function createPantryItem(db, body) {
    const validation = validatePantryInput(body);
    if (!validation.valid) {
        return { status: 400, body: { error: validation.error } };
    }

    const { name, quantity, unit, category, location, purchase_date, expiry_date, notes } = body;
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
        return { status: 201, body: result.rows[0] };
    } catch (error) {
        return { status: 500, body: { error: 'Failed to create pantry item' } };
    }
}

async function updatePantryItem(db, id, body) {
    const validation = validatePantryInput(body);
    if (!validation.valid) {
        return { status: 400, body: { error: validation.error } };
    }

    const { name, quantity, unit, category, location, purchase_date, expiry_date, notes } = body;
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
            return { status: 404, body: { error: 'Pantry item not found' } };
        }
        return { status: 200, body: result.rows[0] };
    } catch (error) {
        return { status: 500, body: { error: 'Failed to update pantry item' } };
    }
}

async function deletePantryItem(db, id) {
    try {
        const result = await db.query(
            'DELETE FROM pantry_items WHERE id = $1 RETURNING id',
            [id]
        );
        if (result.rows.length === 0) {
            return { status: 404, body: { error: 'Pantry item not found' } };
        }
        return { status: 200, body: { success: true, id: result.rows[0].id } };
    } catch (error) {
        return { status: 500, body: { error: 'Failed to delete pantry item' } };
    }
}

// ========== Tests ==========

describe('Pantry Endpoints', () => {
    describe('GET /pantry', () => {
        it('should return all pantry items', async () => {
            const mockItems = [
                { id: 1, name: 'Mehl', quantity: 500, unit: 'g' },
                { id: 2, name: 'Zucker', quantity: 1, unit: 'kg' }
            ];
            const db = createMockDb({
                query: async () => ({ rows: mockItems })
            });

            const response = await getAllPantryItems(db);

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.length, 2);
            assert.strictEqual(response.body[0].name, 'Mehl');
        });

        it('should return empty array when no items exist', async () => {
            const db = createMockDb({
                query: async () => ({ rows: [] })
            });

            const response = await getAllPantryItems(db);

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.length, 0);
        });

        it('should return 500 on database error', async () => {
            const db = createMockDb({
                query: async () => { throw new Error('Connection refused'); }
            });

            const response = await getAllPantryItems(db);

            assert.strictEqual(response.status, 500);
            assert.strictEqual(response.body.error, 'Failed to fetch pantry items');
        });
    });

    describe('GET /pantry/expiring', () => {
        it('should return expiring items', async () => {
            const mockItems = [
                { id: 1, name: 'Milch', expiry_date: '2024-01-18' }
            ];
            const db = createMockDb({
                query: async () => ({ rows: mockItems })
            });

            const response = await getExpiringItems(db, '3');

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.length, 1);
            assert.strictEqual(response.body[0].name, 'Milch');
        });

        it('should default to 3 days when no days parameter given', async () => {
            let capturedParams;
            const db = createMockDb({
                query: async (_sql, params) => {
                    capturedParams = params;
                    return { rows: [] };
                }
            });

            await getExpiringItems(db, undefined);

            assert.strictEqual(capturedParams[0], 3);
        });

        it('should parse days parameter as integer', async () => {
            let capturedParams;
            const db = createMockDb({
                query: async (_sql, params) => {
                    capturedParams = params;
                    return { rows: [] };
                }
            });

            await getExpiringItems(db, '7');

            assert.strictEqual(capturedParams[0], 7);
        });

        it('should return 500 on database error', async () => {
            const db = createMockDb({
                query: async () => { throw new Error('DB error'); }
            });

            const response = await getExpiringItems(db, '3');

            assert.strictEqual(response.status, 500);
            assert.strictEqual(response.body.error, 'Failed to fetch expiring pantry items');
        });
    });

    describe('POST /pantry', () => {
        it('should create a pantry item with all fields', async () => {
            const newItem = {
                name: 'Mehl',
                quantity: 500,
                unit: 'g',
                category: 'Trockenwaren',
                location: 'Vorratsschrank',
                purchase_date: '2024-01-15',
                expiry_date: '2024-06-15',
                notes: 'Bio-Mehl'
            };
            const db = createMockDb({
                query: async () => ({ rows: [{ id: 1, ...newItem }] })
            });

            const response = await createPantryItem(db, newItem);

            assert.strictEqual(response.status, 201);
            assert.strictEqual(response.body.name, 'Mehl');
            assert.strictEqual(response.body.id, 1);
        });

        it('should create a pantry item with only name', async () => {
            const db = createMockDb({
                query: async () => ({ rows: [{ id: 1, name: 'Salz' }] })
            });

            const response = await createPantryItem(db, { name: 'Salz' });

            assert.strictEqual(response.status, 201);
            assert.strictEqual(response.body.name, 'Salz');
        });

        it('should trim whitespace from name', async () => {
            let capturedParams;
            const db = createMockDb({
                query: async (_sql, params) => {
                    capturedParams = params;
                    return { rows: [{ id: 1, name: 'Mehl' }] };
                }
            });

            await createPantryItem(db, { name: '  Mehl  ' });

            assert.strictEqual(capturedParams[0], 'Mehl');
        });

        it('should return 400 when name is missing', async () => {
            const db = createMockDb();

            const response = await createPantryItem(db, {});

            assert.strictEqual(response.status, 400);
            assert.strictEqual(response.body.error, 'Name ist erforderlich');
        });

        it('should return 400 when name is empty string', async () => {
            const db = createMockDb();

            const response = await createPantryItem(db, { name: '' });

            assert.strictEqual(response.status, 400);
            assert.strictEqual(response.body.error, 'Name ist erforderlich');
        });

        it('should return 400 when name is only whitespace', async () => {
            const db = createMockDb();

            const response = await createPantryItem(db, { name: '   ' });

            assert.strictEqual(response.status, 400);
            assert.strictEqual(response.body.error, 'Name ist erforderlich');
        });

        it('should return 500 on database error', async () => {
            const db = createMockDb({
                query: async () => { throw new Error('Insert failed'); }
            });

            const response = await createPantryItem(db, { name: 'Mehl' });

            assert.strictEqual(response.status, 500);
            assert.strictEqual(response.body.error, 'Failed to create pantry item');
        });
    });

    describe('PUT /pantry/:id', () => {
        it('should update an existing pantry item', async () => {
            const updatedItem = { id: 1, name: 'Vollkornmehl', quantity: 1000, unit: 'g' };
            const db = createMockDb({
                query: async () => ({ rows: [updatedItem] })
            });

            const response = await updatePantryItem(db, 1, {
                name: 'Vollkornmehl', quantity: 1000, unit: 'g'
            });

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.name, 'Vollkornmehl');
        });

        it('should return 404 when item does not exist', async () => {
            const db = createMockDb({
                query: async () => ({ rows: [] })
            });

            const response = await updatePantryItem(db, 999, { name: 'Test' });

            assert.strictEqual(response.status, 404);
            assert.strictEqual(response.body.error, 'Pantry item not found');
        });

        it('should return 400 when name is missing', async () => {
            const db = createMockDb();

            const response = await updatePantryItem(db, 1, {});

            assert.strictEqual(response.status, 400);
            assert.strictEqual(response.body.error, 'Name ist erforderlich');
        });

        it('should return 500 on database error', async () => {
            const db = createMockDb({
                query: async () => { throw new Error('Update failed'); }
            });

            const response = await updatePantryItem(db, 1, { name: 'Mehl' });

            assert.strictEqual(response.status, 500);
            assert.strictEqual(response.body.error, 'Failed to update pantry item');
        });
    });

    describe('DELETE /pantry/:id', () => {
        it('should delete an existing pantry item', async () => {
            const db = createMockDb({
                query: async () => ({ rows: [{ id: 1 }] })
            });

            const response = await deletePantryItem(db, 1);

            assert.strictEqual(response.status, 200);
            assert.strictEqual(response.body.success, true);
            assert.strictEqual(response.body.id, 1);
        });

        it('should return 404 when item does not exist', async () => {
            const db = createMockDb({
                query: async () => ({ rows: [] })
            });

            const response = await deletePantryItem(db, 999);

            assert.strictEqual(response.status, 404);
            assert.strictEqual(response.body.error, 'Pantry item not found');
        });

        it('should return 500 on database error', async () => {
            const db = createMockDb({
                query: async () => { throw new Error('Delete failed'); }
            });

            const response = await deletePantryItem(db, 1);

            assert.strictEqual(response.status, 500);
            assert.strictEqual(response.body.error, 'Failed to delete pantry item');
        });
    });

    describe('Validation', () => {
        it('should validate name is required', () => {
            assert.deepStrictEqual(validatePantryInput({}), { valid: false, error: 'Name ist erforderlich' });
        });

        it('should validate name is not empty', () => {
            assert.deepStrictEqual(validatePantryInput({ name: '' }), { valid: false, error: 'Name ist erforderlich' });
        });

        it('should validate name is not whitespace-only', () => {
            assert.deepStrictEqual(validatePantryInput({ name: '   ' }), { valid: false, error: 'Name ist erforderlich' });
        });

        it('should pass validation with valid name', () => {
            assert.deepStrictEqual(validatePantryInput({ name: 'Mehl' }), { valid: true });
        });
    });
});
