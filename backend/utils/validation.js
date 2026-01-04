/**
 * URL Validation utilities for SSRF prevention
 */

// Allowlist of trusted recipe domains
const ALLOWED_RECIPE_DOMAINS = [
    'chefkoch.de',
    'www.chefkoch.de',
    'eatsmarter.de',
    'www.eatsmarter.de',
    'lecker.de',
    'www.lecker.de',
    'gutekueche.at',
    'www.gutekueche.at',
    'kochbar.de',
    'www.kochbar.de',
    'rezeptwelt.de',
    'www.rezeptwelt.de',
    'kitchenstories.com',
    'www.kitchenstories.com',
    'allrecipes.com',
    'www.allrecipes.com',
    'bbcgoodfood.com',
    'www.bbcgoodfood.com',
    'seriouseats.com',
    'www.seriouseats.com',
    'food.com',
    'www.food.com',
    'epicurious.com',
    'www.epicurious.com',
    'bonappetit.com',
    'www.bonappetit.com',
    'delish.com',
    'www.delish.com',
    'tasty.co',
    'www.tasty.co',
    'simplyrecipes.com',
    'www.simplyrecipes.com',
    'foodnetwork.com',
    'www.foodnetwork.com'
];

/**
 * Validates a URL against the allowlist of trusted recipe domains
 * @param {string} urlString - The URL to validate
 * @returns {string} The validated URL
 * @throws {Error} If URL is invalid or domain not allowed
 */
function validateUrl(urlString) {
    let url;
    try {
        url = new URL(urlString);
    } catch {
        throw new Error('Invalid URL format');
    }

    // Only allow http and https protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Only HTTP and HTTPS protocols are allowed');
    }

    // Check against allowlist of trusted domains
    const hostname = url.hostname.toLowerCase();
    if (!ALLOWED_RECIPE_DOMAINS.includes(hostname)) {
        throw new Error(
            `Domain "${hostname}" is not in the list of allowed recipe websites. ` +
            `Allowed domains: ${ALLOWED_RECIPE_DOMAINS.filter(d => !d.startsWith('www.')).join(', ')}`
        );
    }

    return url.href;
}

// Supported video platforms with strict URL patterns
const VIDEO_PLATFORMS = {
    tiktok: /^https?:\/\/(www\.|vm\.)?tiktok\.com\//i,
    instagram: /^https?:\/\/(www\.)?instagram\.com\/(reel|p)\//i,
    pinterest: /^https?:\/\/(www\.)?pinterest\.(com|de)\/pin\//i,
    youtube: /^https?:\/\/(www\.)?(youtube\.com\/shorts|youtu\.be)\//i
};

/**
 * Check if URL is a supported video platform
 * @param {string} url - The URL to check
 * @returns {boolean} True if URL matches a supported platform
 */
function isVideoUrl(url) {
    return Object.values(VIDEO_PLATFORMS).some(regex => regex.test(url));
}

/**
 * Validate and sanitize URL to prevent command injection
 * @param {string} url - The URL to sanitize
 * @returns {string|null} Sanitized URL or null if invalid
 */
function sanitizeVideoUrl(url) {
    // Must be a valid URL
    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return null;
    }

    // Must be http or https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return null;
    }

    // Must match one of our supported platforms
    if (!isVideoUrl(url)) {
        return null;
    }

    // Return the sanitized URL (reconstructed from parsed components)
    return parsed.href;
}

/**
 * Get the platform name for a video URL
 * @param {string} url - The video URL
 * @returns {string} Platform name or 'unknown'
 */
function getVideoPlatform(url) {
    for (const [platform, regex] of Object.entries(VIDEO_PLATFORMS)) {
        if (regex.test(url)) {
            return platform;
        }
    }
    return 'unknown';
}

module.exports = {
    ALLOWED_RECIPE_DOMAINS,
    validateUrl,
    VIDEO_PLATFORMS,
    isVideoUrl,
    sanitizeVideoUrl,
    getVideoPlatform
};
