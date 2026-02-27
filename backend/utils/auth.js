/**
 * Authentication utilities
 * Password hashing (bcryptjs) and JWT token management
 */

const bcrypt = require('bcryptjs');
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
 * @param {{ id: string, email: string, name?: string }} user
 * @returns {{ sub: string, email: string, name: string }}
 */
function createUserPayload(user) {
    return {
        sub: user.id,
        email: user.email,
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
 * Generate a signed refresh token (longer-lived, minimal payload)
 * @param {{ id: string }} user
 * @returns {string}
 */
function generateRefreshToken(user) {
    return jwt.sign({ sub: user.id, type: 'refresh' }, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

/**
 * Verify a refresh token — returns payload or null
 * @param {string} token
 * @returns {{ sub: string, type: string } | null}
 */
function verifyRefreshToken(token) {
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.type !== 'refresh') return null;
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
