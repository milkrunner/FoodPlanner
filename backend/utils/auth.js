/**
 * Authentication utilities
 * Password hashing (bcryptjs) and JWT token management
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const BCRYPT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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
        name: user.name || ''
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

module.exports = {
    validateEmail,
    validatePassword,
    hashPassword,
    verifyPassword,
    createUserPayload,
    generateToken,
    verifyToken,
    extractBearerToken
};
