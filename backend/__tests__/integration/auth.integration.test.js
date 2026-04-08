/**
 * Integration tests for the authentication flow.
 * Tests: Register → Login → Token Refresh → Change Password → Logout
 *
 * Requires a running test PostgreSQL (docker-compose.test.yml).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { runMigrations, resetDatabase, startApp, teardown, request, getPool } = require('./setup');

describe('Auth Integration', () => {
    let baseUrl, server;

    before(async () => {
        await resetDatabase();
        await runMigrations();
        ({ baseUrl, server } = await startApp());
    });

    after(async () => {
        await teardown(server);
    });

    describe('POST /auth/register', () => {
        it('should register a new user', async () => {
            const res = await request(baseUrl, 'POST', '/auth/register', {
                body: { email: 'test@example.com', password: 'TestPass123', name: 'Test User' }
            });
            assert.strictEqual(res.status, 201);
            assert.ok(res.data.token, 'should return a JWT token');
            assert.strictEqual(res.data.user.email, 'test@example.com');
            assert.strictEqual(res.data.user.name, 'Test User');
            assert.ok(res.setCookie.includes('refresh_token'), 'should set refresh cookie');
        });

        it('should reject duplicate email', async () => {
            const res = await request(baseUrl, 'POST', '/auth/register', {
                body: { email: 'test@example.com', password: 'TestPass123', name: 'Duplicate' }
            });
            assert.strictEqual(res.status, 409);
        });

        it('should reject weak password', async () => {
            const res = await request(baseUrl, 'POST', '/auth/register', {
                body: { email: 'weak@example.com', password: 'short', name: 'Weak' }
            });
            assert.strictEqual(res.status, 400);
        });

        it('should reject invalid email', async () => {
            const res = await request(baseUrl, 'POST', '/auth/register', {
                body: { email: 'not-an-email', password: 'TestPass123', name: 'Bad' }
            });
            assert.strictEqual(res.status, 400);
        });
    });

    describe('POST /auth/login', () => {
        it('should login with correct credentials', async () => {
            const res = await request(baseUrl, 'POST', '/auth/login', {
                body: { email: 'test@example.com', password: 'TestPass123' }
            });
            assert.strictEqual(res.status, 200);
            assert.ok(res.data.token);
            assert.strictEqual(res.data.user.email, 'test@example.com');
        });

        it('should reject wrong password', async () => {
            const res = await request(baseUrl, 'POST', '/auth/login', {
                body: { email: 'test@example.com', password: 'WrongPass123' }
            });
            assert.strictEqual(res.status, 401);
        });

        it('should reject non-existent user', async () => {
            const res = await request(baseUrl, 'POST', '/auth/login', {
                body: { email: 'nobody@example.com', password: 'TestPass123' }
            });
            assert.strictEqual(res.status, 401);
        });
    });

    describe('GET /auth/me', () => {
        it('should return current user with valid token', async () => {
            const login = await request(baseUrl, 'POST', '/auth/login', {
                body: { email: 'test@example.com', password: 'TestPass123' }
            });
            const res = await request(baseUrl, 'GET', '/auth/me', {
                headers: { 'Authorization': `Bearer ${login.data.token}` }
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.data.email, 'test@example.com');
        });

        it('should reject request without token', async () => {
            const res = await request(baseUrl, 'GET', '/auth/me');
            assert.strictEqual(res.status, 401);
        });

        it('should reject request with invalid token', async () => {
            const res = await request(baseUrl, 'GET', '/auth/me', {
                headers: { 'Authorization': 'Bearer invalid-token-here' }
            });
            assert.strictEqual(res.status, 401);
        });
    });

    describe('POST /auth/refresh', () => {
        it('should refresh access token using cookie', async () => {
            // Login to get refresh cookie
            const login = await request(baseUrl, 'POST', '/auth/login', {
                body: { email: 'test@example.com', password: 'TestPass123' }
            });
            const cookies = login.setCookie.split(';')[0]; // "refresh_token=..."

            const res = await request(baseUrl, 'POST', '/auth/refresh', {
                body: {},
                cookies
            });
            assert.strictEqual(res.status, 200);
            assert.ok(res.data.token, 'should return a new access token');
        });

        it('should reject refresh without cookie', async () => {
            const res = await request(baseUrl, 'POST', '/auth/refresh', {
                body: {}
            });
            assert.strictEqual(res.status, 400);
        });
    });

    describe('POST /auth/change-password', () => {
        it('should change password with valid current password', async () => {
            const login = await request(baseUrl, 'POST', '/auth/login', {
                body: { email: 'test@example.com', password: 'TestPass123' }
            });
            const res = await request(baseUrl, 'POST', '/auth/change-password', {
                body: { currentPassword: 'TestPass123', newPassword: 'NewPass456' },
                headers: { 'Authorization': `Bearer ${login.data.token}` }
            });
            assert.strictEqual(res.status, 200);

            // Verify new password works
            const reLogin = await request(baseUrl, 'POST', '/auth/login', {
                body: { email: 'test@example.com', password: 'NewPass456' }
            });
            assert.strictEqual(reLogin.status, 200);
        });

        it('should reject wrong current password', async () => {
            const login = await request(baseUrl, 'POST', '/auth/login', {
                body: { email: 'test@example.com', password: 'NewPass456' }
            });
            const res = await request(baseUrl, 'POST', '/auth/change-password', {
                body: { currentPassword: 'WrongPass', newPassword: 'Another789' },
                headers: { 'Authorization': `Bearer ${login.data.token}` }
            });
            assert.strictEqual(res.status, 401);
        });
    });

    describe('POST /auth/logout', () => {
        it('should clear refresh cookie', async () => {
            const login = await request(baseUrl, 'POST', '/auth/login', {
                body: { email: 'test@example.com', password: 'NewPass456' }
            });
            const res = await request(baseUrl, 'POST', '/auth/logout', {
                headers: { 'Authorization': `Bearer ${login.data.token}` },
                body: {}
            });
            assert.strictEqual(res.status, 200);
            assert.ok(res.setCookie.includes('refresh_token=;'), 'should clear refresh cookie');
        });
    });

    describe('Inactive user', () => {
        it('should reject login for deactivated user', async () => {
            // Deactivate user directly in DB
            const pool = getPool();
            await pool.query("UPDATE users SET is_active = false WHERE email = 'test@example.com'");

            const res = await request(baseUrl, 'POST', '/auth/login', {
                body: { email: 'test@example.com', password: 'NewPass456' }
            });
            assert.strictEqual(res.status, 403);

            // Re-activate for other tests
            await pool.query("UPDATE users SET is_active = true WHERE email = 'test@example.com'");
        });
    });
});
