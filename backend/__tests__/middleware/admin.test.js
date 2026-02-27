/**
 * Admin middleware and route handler tests
 * Tests pure middleware logic — no external dependencies required
 * Run with: node --test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// ── requireAdmin middleware replicated inline (no npm deps) ─────────────────

function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Administratorrechte erforderlich' });
    }
    next();
}

// ── Helper to create mock req/res/next ──────────────────────────────────────

function createMockRes() {
    const res = {
        _status: null,
        _json: null,
        status(code) { res._status = code; return res; },
        json(data) { res._json = data; return res; }
    };
    return res;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('requireAdmin middleware', () => {
    it('should call next() when user is admin', () => {
        const req = { user: { id: '1', email: 'admin@test.de', role: 'admin' } };
        const res = createMockRes();
        let nextCalled = false;
        requireAdmin(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
        assert.strictEqual(res._status, null);
    });

    it('should return 403 when user is not admin', () => {
        const req = { user: { id: '2', email: 'user@test.de', role: 'user' } };
        const res = createMockRes();
        let nextCalled = false;
        requireAdmin(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res._status, 403);
        assert.ok(res._json.error.includes('Administratorrechte'));
    });

    it('should return 403 when req.user is missing', () => {
        const req = {};
        const res = createMockRes();
        let nextCalled = false;
        requireAdmin(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res._status, 403);
    });

    it('should return 403 when role is undefined', () => {
        const req = { user: { id: '3', email: 'norole@test.de' } };
        const res = createMockRes();
        let nextCalled = false;
        requireAdmin(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res._status, 403);
    });

    it('should return 403 when role is empty string', () => {
        const req = { user: { id: '4', email: 'empty@test.de', role: '' } };
        const res = createMockRes();
        let nextCalled = false;
        requireAdmin(req, res, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, false);
        assert.strictEqual(res._status, 403);
    });
});

describe('admin route self-action prevention', () => {
    // Inline validation logic from admin routes

    function validateSelfAction(reqUserId, targetId) {
        return reqUserId === targetId;
    }

    it('should detect self-action when IDs match', () => {
        assert.strictEqual(validateSelfAction('abc-123', 'abc-123'), true);
    });

    it('should allow action on different user', () => {
        assert.strictEqual(validateSelfAction('abc-123', 'def-456'), false);
    });
});

describe('role validation', () => {
    function isValidRole(role) {
        return ['user', 'admin'].includes(role);
    }

    it('should accept "user" role', () => {
        assert.strictEqual(isValidRole('user'), true);
    });

    it('should accept "admin" role', () => {
        assert.strictEqual(isValidRole('admin'), true);
    });

    it('should reject unknown role', () => {
        assert.strictEqual(isValidRole('superadmin'), false);
    });

    it('should reject empty string', () => {
        assert.strictEqual(isValidRole(''), false);
    });

    it('should reject undefined', () => {
        assert.strictEqual(isValidRole(undefined), false);
    });
});

describe('is_active validation', () => {
    function isValidStatus(is_active) {
        return typeof is_active === 'boolean';
    }

    it('should accept true', () => {
        assert.strictEqual(isValidStatus(true), true);
    });

    it('should accept false', () => {
        assert.strictEqual(isValidStatus(false), true);
    });

    it('should reject string "true"', () => {
        assert.strictEqual(isValidStatus('true'), false);
    });

    it('should reject number 1', () => {
        assert.strictEqual(isValidStatus(1), false);
    });

    it('should reject null', () => {
        assert.strictEqual(isValidStatus(null), false);
    });
});

describe('createUserPayload with role', () => {
    function createUserPayload(user) {
        return {
            sub: user.id,
            email: user.email,
            name: user.name || '',
            role: user.role || 'user'
        };
    }

    it('should include role in payload', () => {
        const user = { id: '1', email: 'admin@test.de', name: 'Admin', role: 'admin' };
        const payload = createUserPayload(user);
        assert.strictEqual(payload.role, 'admin');
    });

    it('should default role to "user" when missing', () => {
        const user = { id: '2', email: 'user@test.de', name: 'User' };
        const payload = createUserPayload(user);
        assert.strictEqual(payload.role, 'user');
    });

    it('should default role to "user" when empty string', () => {
        const user = { id: '3', email: 'empty@test.de', name: 'Empty', role: '' };
        const payload = createUserPayload(user);
        assert.strictEqual(payload.role, 'user');
    });
});

describe('generateTempPassword', () => {
    // Replicate the logic inline
    function generateTempPassword() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let password = '';
        const bytes = require('crypto').randomBytes(8);
        for (let i = 0; i < 8; i++) {
            password += chars[bytes[i] % chars.length];
        }
        return password;
    }

    it('should generate an 8-character password', () => {
        const pw = generateTempPassword();
        assert.strictEqual(pw.length, 8);
    });

    it('should only contain allowed characters (no ambiguous chars)', () => {
        for (let i = 0; i < 20; i++) {
            const pw = generateTempPassword();
            assert.ok(/^[A-HJ-NP-Za-hj-kmnp-z2-9]+$/.test(pw), `Password "${pw}" contains disallowed chars`);
        }
    });

    it('should generate different passwords', () => {
        const passwords = new Set();
        for (let i = 0; i < 10; i++) {
            passwords.add(generateTempPassword());
        }
        assert.ok(passwords.size > 1, 'All passwords are identical');
    });
});
