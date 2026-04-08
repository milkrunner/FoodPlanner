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
    if (!/[A-Z]/.test(password)) {
        return { valid: false, error: 'Passwort muss mindestens einen Großbuchstaben enthalten' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, error: 'Passwort muss mindestens einen Kleinbuchstaben enthalten' };
    }
    if (!/\d/.test(password)) {
        return { valid: false, error: 'Passwort muss mindestens eine Zahl enthalten' };
    }
    return { valid: true };
}

function validateUsername(username) {
    if (!username || typeof username !== 'string') return { valid: false, error: 'Username is required' };
    const trimmed = username.trim();
    if (trimmed.length < 3) return { valid: false, error: 'Username must be at least 3 characters' };
    if (trimmed.length > 50) return { valid: false, error: 'Username must be at most 50 characters' };
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return { valid: false, error: 'Username may only contain letters, numbers, underscore and hyphen' };
    return { valid: true };
}

function createUserPayload(user) {
    return {
        sub: user.id,
        username: user.username,
        email: user.email || '',
        name: user.name || '',
        role: user.role || 'user'
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

    it('should accept exactly 8 characters with complexity', () => {
        assert.strictEqual(validatePassword('Abcd1234').valid, true);
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
        const result = validatePassword('A' + 'a'.repeat(127) + '1');
        assert.strictEqual(result.valid, false);
        assert.ok(result.error.includes('128'));
    });

    it('should accept password of exactly 128 characters', () => {
        assert.strictEqual(validatePassword('A' + 'a'.repeat(126) + '1').valid, true);
    });

    it('should reject password without uppercase', () => {
        const result = validatePassword('abcdefg1');
        assert.strictEqual(result.valid, false);
        assert.ok(result.error.includes('Großbuchstaben'));
    });

    it('should reject password without lowercase', () => {
        const result = validatePassword('ABCDEFG1');
        assert.strictEqual(result.valid, false);
        assert.ok(result.error.includes('Kleinbuchstaben'));
    });

    it('should reject password without number', () => {
        const result = validatePassword('Abcdefgh');
        assert.strictEqual(result.valid, false);
        assert.ok(result.error.includes('Zahl'));
    });
});

describe('validateUsername', () => {
    it('should accept a valid username', () => {
        const result = validateUsername('alice');
        assert.strictEqual(result.valid, true);
    });

    it('should accept username with numbers, underscores and hyphens', () => {
        assert.strictEqual(validateUsername('user_name-123').valid, true);
    });

    it('should accept exactly 3 characters', () => {
        assert.strictEqual(validateUsername('abc').valid, true);
    });

    it('should accept exactly 50 characters', () => {
        assert.strictEqual(validateUsername('a'.repeat(50)).valid, true);
    });

    it('should reject username shorter than 3 characters', () => {
        const result = validateUsername('ab');
        assert.strictEqual(result.valid, false);
        assert.ok(result.error.includes('3'));
    });

    it('should reject username longer than 50 characters', () => {
        const result = validateUsername('a'.repeat(51));
        assert.strictEqual(result.valid, false);
        assert.ok(result.error.includes('50'));
    });

    it('should reject username with spaces', () => {
        const result = validateUsername('user name');
        assert.strictEqual(result.valid, false);
    });

    it('should reject username with special characters', () => {
        const result = validateUsername('user@name');
        assert.strictEqual(result.valid, false);
    });

    it('should reject empty string', () => {
        const result = validateUsername('');
        assert.strictEqual(result.valid, false);
    });

    it('should reject null', () => {
        const result = validateUsername(null);
        assert.strictEqual(result.valid, false);
    });

    it('should reject non-string', () => {
        const result = validateUsername(42);
        assert.strictEqual(result.valid, false);
    });
});

describe('createUserPayload', () => {
    it('should map user id to sub claim', () => {
        const user = { id: 'abc-123', username: 'alice', email: 'user@example.com', name: 'Alice' };
        const payload = createUserPayload(user);
        assert.strictEqual(payload.sub, 'abc-123');
    });

    it('should include username in payload', () => {
        const user = { id: 'abc-123', username: 'alice', email: 'user@example.com', name: 'Alice' };
        const payload = createUserPayload(user);
        assert.strictEqual(payload.username, 'alice');
    });

    it('should include email in payload', () => {
        const user = { id: 'abc-123', username: 'alice', email: 'user@example.com', name: 'Alice' };
        const payload = createUserPayload(user);
        assert.strictEqual(payload.email, 'user@example.com');
    });

    it('should default email to empty string when missing', () => {
        const user = { id: 'abc-123', username: 'alice', name: 'Alice' };
        const payload = createUserPayload(user);
        assert.strictEqual(payload.email, '');
    });

    it('should include name in payload', () => {
        const user = { id: 'abc-123', username: 'alice', email: 'user@example.com', name: 'Alice' };
        const payload = createUserPayload(user);
        assert.strictEqual(payload.name, 'Alice');
    });

    it('should default name to empty string when missing', () => {
        const user = { id: 'abc-123', username: 'alice', email: 'user@example.com' };
        const payload = createUserPayload(user);
        assert.strictEqual(payload.name, '');
    });

    it('should include role in payload', () => {
        const user = { id: 'abc-123', username: 'alice', email: 'user@example.com', name: 'Alice', role: 'admin' };
        const payload = createUserPayload(user);
        assert.strictEqual(payload.role, 'admin');
    });

    it('should default role to user', () => {
        const user = { id: 'abc-123', username: 'alice', email: 'user@example.com', name: 'Alice' };
        const payload = createUserPayload(user);
        assert.strictEqual(payload.role, 'user');
    });

    it('should not include password_hash in payload', () => {
        const user = { id: 'abc-123', username: 'alice', email: 'user@example.com', name: 'Alice', password_hash: '$2b$...' };
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
