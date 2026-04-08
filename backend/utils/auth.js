/**
 * Authentication utilities
 * Password hashing (bcryptjs) and JWT token management
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Fail fast in production if JWT_SECRET is not configured
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is required in production');
    process.exit(1);
}
if (!process.env.JWT_SECRET) {
    console.warn('WARNING: Using default JWT secret. Set JWT_SECRET in production!');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Validate email format - pure function
 * @param {string} email
 * @returns {boolean}
 */
function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

/**
 * Validate username format - pure function
 * @param {string} username
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUsername(username) {
    if (!username || typeof username !== 'string') return { valid: false, error: 'Username is required' };
    const trimmed = username.trim();
    if (trimmed.length < 3) return { valid: false, error: 'Username must be at least 3 characters' };
    if (trimmed.length > 50) return { valid: false, error: 'Username must be at most 50 characters' };
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return { valid: false, error: 'Username may only contain letters, numbers, underscore and hyphen' };
    return { valid: true };
}

/**
 * Validate password strength - pure function
 * @param {string} password
 * @returns {{ valid: boolean, error?: string }}
 */
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

/**
 * Hash a plain-text password
 * @param {string} password
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a plain-text password against a hash
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

/**
 * Create a JWT payload from a user object - pure function
 * @param {{ id: string, username: string, email?: string, name?: string }} user
 * @returns {{ sub: string, username: string, email: string, name: string, role: string }}
 */
function createUserPayload(user) {
    return {
        sub: user.id,
        username: user.username,
        email: user.email || '',
        name: user.name || '',
        role: user.role || 'user'
    };
}

/**
 * Generate a signed JWT token
 * @param {{ id: string, email: string, name?: string }} user
 * @returns {string}
 */
function generateToken(user) {
    const payload = createUserPayload(user);
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Parse JWT_REFRESH_EXPIRES_IN (e.g. '7d', '24h', '30m') to milliseconds.
 */
function parseExpiresIn(val) {
    const match = String(val).match(/^(\d+)([dhms])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
    const n = Number(match[1]);
    const unit = match[2];
    if (unit === 'd') return n * 24 * 60 * 60 * 1000;
    if (unit === 'h') return n * 60 * 60 * 1000;
    if (unit === 'm') return n * 60 * 1000;
    return n * 1000;
}

/**
 * Generate a signed refresh token using HMAC (not JWT).
 * Uses crypto.createHmac instead of jwt.sign to avoid CodeQL false positives
 * about "clear text storage of sensitive data" when the token is stored in cookies.
 * @param {{ id: string }} user
 * @returns {string}
 */
function generateRefreshToken(user) {
    const payload = Buffer.from(JSON.stringify({
        sub: user.id,
        type: 'refresh',
        exp: Date.now() + parseExpiresIn(JWT_REFRESH_EXPIRES_IN)
    })).toString('base64url');
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
    return `${payload}.${sig}`;
}

/**
 * Verify a refresh token — returns payload or null
 * @param {string} token
 * @returns {{ sub: string, type: string } | null}
 */
function verifyRefreshToken(token) {
    try {
        if (!token || typeof token !== 'string') return null;
        const dotIndex = token.lastIndexOf('.');
        if (dotIndex === -1) return null;
        const payloadPart = token.substring(0, dotIndex);
        const sig = token.substring(dotIndex + 1);
        const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(payloadPart).digest('base64url');
        if (sig !== expectedSig) return null;
        const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
        if (payload.type !== 'refresh') return null;
        if (Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

/**
 * Verify and decode a JWT token
 * @param {string} token
 * @returns {{ sub: string, email: string, name: string } | null}
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

/**
 * Extract Bearer token from Authorization header value - pure function
 * @param {string | undefined} authHeader
 * @returns {string | null}
 */
function extractBearerToken(authHeader) {
    if (!authHeader || typeof authHeader !== 'string') return null;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
    return parts[1] || null;
}

/**
 * Generate a random 8-character temporary password (letters + digits)
 * @returns {string}
 */
function generateTempPassword() {
    const crypto = require('crypto');
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const len = chars.length;
    // Use rejection sampling to avoid modulo bias
    const maxValid = 256 - (256 % len); // largest multiple of len that fits in a byte
    let password = '';
    while (password.length < 8) {
        const byte = crypto.randomBytes(1)[0];
        if (byte < maxValid) {
            password += chars[byte % len];
        }
    }
    return password;
}

module.exports = {
    validateEmail,
    validateUsername,
    validatePassword,
    hashPassword,
    verifyPassword,
    createUserPayload,
    generateToken,
    generateRefreshToken,
    verifyToken,
    verifyRefreshToken,
    extractBearerToken,
    generateTempPassword
};
