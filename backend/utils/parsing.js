/**
 * Parsing utilities for request data
 */

const parseNullableInt = (value) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
};

const parseNullableText = (value) => {
    if (value === undefined || value === null) {
        return null;
    }
    const trimmed = String(value).trim();
    return trimmed.length === 0 ? null : trimmed;
};

const parseBooleanFlag = (value, fallback = false) => {
    if (value === undefined || value === null) {
        return fallback;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
            return true;
        }
        if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
            return false;
        }
    }
    return fallback;
};

module.exports = {
    parseNullableInt,
    parseNullableText,
    parseBooleanFlag
};
