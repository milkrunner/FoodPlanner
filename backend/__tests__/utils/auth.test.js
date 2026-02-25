/**
 * Auth utility tests using Node.js built-in test runner
 * Tests pure functions only — no external dependencies required
 * Run with: node --test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// ── Pure functions replicated inline so tests need no npm packages ────────────

function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return { valid: false, error: 'Passwort ist erforderlich' };
    }
    if (password.length < 8) {
        return { valid: false, error: 'Passwort muss mindestens 8 Zeichen lang sein' };
    }
    if (password.length > 128) {
        return { valid: false, error: 'Passwort darf maximal 128 Zeichen lang sein' };
    }
    return { valid: true };
}

function createUserPayload(user) {
    return {
        sub: user.id,
        email: user.email,
        name: user.name || ''
    };
}

function extractBearerToken(authHeader) {
    if (!authHeader || typeof authHeader !== 'string') return null;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
    return parts[1] || null;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('validateEmail', () => {
    it('should accept a valid email', () => {
        assert.strictEqual(validateEmail('user@example.com'), true);
    });

    it('should accept email with subdomain', () => {
        assert.strictEqual(validateEmail('user@mail.example.de'), true);
    });

    it('should reject missing @', () => {
        assert.strictEqual(validateEmail('userexample.com'), false);
    });

    it('should reject missing domain', () => {
        assert.strictEqual(validateEmail('user@'), false);
    });

    it('should reject empty string', () => {
        assert.strictEqual(validateEmail(''), false);
    });

    it('should reject null', () => {
        assert.strictEqual(validateEmail(null), false);
    });

    it('should reject non-string', () => {
        assert.strictEqual(validateEmail(42), false);
    });

    it('should trim whitespace before validating', () => {
        assert.strictEqual(validateEmail('  user@example.com  '), true);
    });

    it('should reject domain without TLD', () => {
        assert.strictEqual(validateEmail('user@localhost'), false);
    });

    it('should not hang on ReDoS payload', () => {
        const start = Date.now();
        const malicious = '!@' + '!.'.repeat(1000);
        validateEmail(malicious);
        const elapsed = Date.now() - start;
        assert.ok(elapsed < 100, `Took ${elapsed}ms — possible ReDoS`);
    });
});

describe('validatePassword', () => {
    it('should accept a valid password', () => {
        const result = validatePassword('securePass1');
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.error, undefined);
    });

    it('should accept exactly 8 characters', () => {
        assert.strictEqual(validatePassword('abcd1234').valid, true);
    });

    it('should reject password shorter than 8 characters', () => {
        const result = validatePassword('short');
        assert.strictEqual(result.valid, false);
        assert.ok(result.error.includes('8'));
    });

    it('should reject empty password', () => {
        const result = validatePassword('');
        assert.strictEqual(result.valid, false);
    });

    it('should reject null', () => {
        const result = validatePassword(null);
        assert.strictEqual(result.valid, false);
    });

    it('should reject password longer than 128 characters', () => {
        const result = validatePassword('a'.repeat(129));
        assert.strictEqual(result.valid, false);
        assert.ok(result.error.includes('128'));
    });

    it('should accept password of exactly 128 characters', () => {
        assert.strictEqual(validatePassword('a'.repeat(128)).valid, true);
    });
});

describe('createUserPayload', () => {
    it('should map user id to sub claim', () => {
        const user = { id: 'abc-123', email: 'user@example.com', name: 'Alice' };
        const payload = createUserPayload(user);
        assert.strictEqual(payload.sub, 'abc-123');
    });

    it('should include email in payload', () => {
        const user = { id: 'abc-123', email: 'user@example.com', name: 'Alice' };
        const payload = createUserPayload(user);
        assert.strictEqual(payload.email, 'user@example.com');
    });

    it('should include name in payload', () => {
        const user = { id: 'abc-123', email: 'user@example.com', name: 'Alice' };
        const payload = createUserPayload(user);
        assert.strictEqual(payload.name, 'Alice');
    });

    it('should default name to empty string when missing', () => {
        const user = { id: 'abc-123', email: 'user@example.com' };
        const payload = createUserPayload(user);
        assert.strictEqual(payload.name, '');
    });

    it('should not include password_hash in payload', () => {
        const user = { id: 'abc-123', email: 'user@example.com', name: 'Alice', password_hash: '$2b$...' };
        const payload = createUserPayload(user);
        assert.strictEqual(payload.password_hash, undefined);
    });
});

describe('extractBearerToken', () => {
    it('should extract token from valid Bearer header', () => {
        const token = extractBearerToken('Bearer mytoken123');
        assert.strictEqual(token, 'mytoken123');
    });

    it('should be case-insensitive for "Bearer"', () => {
        const token = extractBearerToken('bearer mytoken123');
        assert.strictEqual(token, 'mytoken123');
    });

    it('should return null for missing header', () => {
        assert.strictEqual(extractBearerToken(undefined), null);
    });

    it('should return null for empty string', () => {
        assert.strictEqual(extractBearerToken(''), null);
    });

    it('should return null for non-Bearer auth scheme', () => {
        assert.strictEqual(extractBearerToken('Basic dXNlcjpwYXNz'), null);
    });

    it('should return null for malformed header (no space)', () => {
        assert.strictEqual(extractBearerToken('Bearertoken'), null);
    });

    it('should return null when token part is empty', () => {
        assert.strictEqual(extractBearerToken('Bearer '), null);
    });
});
