/**
 * AI input sanitization and response parsing utilities.
 * Prevents prompt injection and provides safe JSON extraction from AI responses.
 */

/**
 * Sanitize user input before embedding in AI prompts.
 * Strips HTML tags, control characters, and excessive whitespace.
 * @param {string} input - raw user input
 * @param {number} [maxLength=1000] - maximum allowed length
 * @returns {string} sanitized string
 */
function sanitizeForPrompt(input, maxLength = 1000) {
    if (!input || typeof input !== 'string') return '';
    // Strip HTML tags using O(n) character scan — no regex backtracking risk
    let result = '';
    let inTag = false;
    for (const ch of input) {
        if (ch === '<') { inTag = true; continue; }
        if (ch === '>') { inTag = false; continue; }
        if (!inTag) result += ch;
    }
    return result
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars (keep \n, \r, \t)
        .replace(/\s+/g, ' ')           // collapse whitespace
        .trim()
        .slice(0, maxLength);
}

/**
 * Sanitize an array of strings for use in AI prompts.
 * @param {string[]} items - array of user inputs
 * @param {number} [maxItemLength=200] - max length per item
 * @param {number} [maxItems=50] - max number of items
 * @returns {string[]} sanitized array
 */
function sanitizeArrayForPrompt(items, maxItemLength = 200, maxItems = 50) {
    if (!Array.isArray(items)) return [];
    return items
        .slice(0, maxItems)
        .map(item => sanitizeForPrompt(String(item), maxItemLength))
        .filter(item => item.length > 0);
}

/**
 * Extract and parse JSON from an AI response that may contain markdown code blocks.
 * @param {string} text - raw AI response text
 * @returns {any} parsed JSON object/array
 * @throws {SyntaxError} if JSON parsing fails
 */
function extractJsonFromAiResponse(text) {
    let jsonText = text.trim();
    // Strip markdown code block wrappers
    if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?$/g, '').trim();
    }
    return JSON.parse(jsonText);
}

module.exports = {
    sanitizeForPrompt,
    sanitizeArrayForPrompt,
    extractJsonFromAiResponse
};
