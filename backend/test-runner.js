#!/usr/bin/env node
/**
 * Simple test runner without external dependencies
 * Run with: node test-runner.js
 */

const path = require('path');

// Colors for terminal output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m',
    dim: '\x1b[2m'
};

// Test state
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

// Simple test framework
function describe(name, fn) {
    console.log(`\n${name}`);
    fn();
}

function it(name, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`  ${colors.green}✓${colors.reset} ${colors.dim}${name}${colors.reset}`);
    } catch (error) {
        failedTests++;
        console.log(`  ${colors.red}✕${colors.reset} ${name}`);
        failures.push({ name, error: error.message });
    }
}

// Assertion helpers
function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
            }
        },
        toEqual(expected) {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
            }
        },
        toBeNull() {
            if (actual !== null) {
                throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
            }
        },
        toBeDefined() {
            if (actual === undefined) {
                throw new Error(`Expected value to be defined`);
            }
        },
        toBeGreaterThan(expected) {
            if (!(actual > expected)) {
                throw new Error(`Expected ${actual} to be greater than ${expected}`);
            }
        },
        toContain(expected) {
            if (Array.isArray(actual)) {
                if (!actual.includes(expected)) {
                    throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
                }
            } else if (typeof actual === 'string') {
                if (!actual.includes(expected)) {
                    throw new Error(`Expected string to contain ${JSON.stringify(expected)}`);
                }
            }
        },
        toHaveLength(expected) {
            if (actual.length !== expected) {
                throw new Error(`Expected length ${expected}, got ${actual.length}`);
            }
        },
        toThrow(expectedMessage) {
            if (typeof actual !== 'function') {
                throw new Error('Expected a function');
            }
            let threw = false;
            let actualMessage = '';
            try {
                actual();
            } catch (e) {
                threw = true;
                actualMessage = e.message;
            }
            if (!threw) {
                throw new Error(`Expected function to throw`);
            }
            if (expectedMessage && !actualMessage.includes(expectedMessage)) {
                throw new Error(`Expected error message to contain "${expectedMessage}", got "${actualMessage}"`);
            }
        }
    };
}

// Make test functions global
global.describe = describe;
global.it = it;
global.expect = expect;

// ============ TESTS ============

console.log('Running tests...\n');

// ---- Validation Tests ----
const {
    validateUrl,
    isVideoUrl,
    sanitizeVideoUrl,
    getVideoPlatform,
    ALLOWED_RECIPE_DOMAINS
} = require('./utils/validation');
const {
    resolveFavoriteFlagFromBody,
    resolveToggleTarget
} = require('./utils/favorites');

describe('URL Validation', () => {
    describe('  validateUrl', () => {
        it('should accept valid chefkoch.de URLs', () => {
            const url = 'https://www.chefkoch.de/rezepte/12345';
            expect(validateUrl(url)).toBe(url);
        });

        it('should accept valid allrecipes.com URLs', () => {
            const url = 'https://www.allrecipes.com/recipe/12345/spaghetti';
            expect(validateUrl(url)).toBe(url);
        });

        it('should reject invalid URL format', () => {
            expect(() => validateUrl('not-a-url')).toThrow('Invalid URL format');
        });

        it('should reject non-HTTP/HTTPS protocols', () => {
            expect(() => validateUrl('ftp://chefkoch.de/file')).toThrow('Only HTTP and HTTPS protocols are allowed');
            expect(() => validateUrl('file:///etc/passwd')).toThrow('Only HTTP and HTTPS protocols are allowed');
        });

        it('should reject domains not in allowlist', () => {
            expect(() => validateUrl('https://evil.com/malware')).toThrow('not in the list of allowed');
            expect(() => validateUrl('https://localhost/admin')).toThrow('not in the list of allowed');
        });
    });

    describe('  isVideoUrl', () => {
        it('should recognize TikTok URLs', () => {
            expect(isVideoUrl('https://www.tiktok.com/@user/video/123')).toBe(true);
            expect(isVideoUrl('https://vm.tiktok.com/abc123')).toBe(true);
        });

        it('should recognize Instagram Reels', () => {
            expect(isVideoUrl('https://www.instagram.com/reel/ABC123')).toBe(true);
        });

        it('should reject non-video URLs', () => {
            expect(isVideoUrl('https://www.google.com')).toBe(false);
            expect(isVideoUrl('https://chefkoch.de/rezepte')).toBe(false);
        });
    });

    describe('  sanitizeVideoUrl', () => {
        it('should return sanitized URL for valid video URLs', () => {
            const url = 'https://www.tiktok.com/@user/video/123';
            expect(sanitizeVideoUrl(url)).toBe(url);
        });

        it('should return null for invalid URLs', () => {
            expect(sanitizeVideoUrl('not-a-url')).toBeNull();
            expect(sanitizeVideoUrl('')).toBeNull();
        });

        it('should return null for non-video platform URLs', () => {
            expect(sanitizeVideoUrl('https://evil.com/malware')).toBeNull();
        });
    });

    describe('  getVideoPlatform', () => {
        it('should identify TikTok', () => {
            expect(getVideoPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
        });

        it('should identify Instagram', () => {
            expect(getVideoPlatform('https://www.instagram.com/reel/ABC')).toBe('instagram');
        });

        it('should return unknown for unrecognized URLs', () => {
            expect(getVideoPlatform('https://google.com')).toBe('unknown');
        });
    });
});

describe('Favorites Helpers', () => {
    describe('resolveFavoriteFlagFromBody', () => {
        it('should prefer is_favorite flag when present', () => {
            const body = { is_favorite: true, isFavorite: false };
            expect(resolveFavoriteFlagFromBody(body, false)).toBe(true);
        });

        it('should read camelCase property when snake_case missing', () => {
            const body = { isFavorite: true };
            expect(resolveFavoriteFlagFromBody(body, false)).toBe(true);
        });

        it('should fall back to provided default when missing', () => {
            expect(resolveFavoriteFlagFromBody({}, null)).toBe(null);
        });
    });

    describe('resolveToggleTarget', () => {
        it('should honor explicit is_favorite flag', () => {
            const body = { is_favorite: false };
            expect(resolveToggleTarget(body, true)).toBe(false);
        });

        it('should invert current state when no flag provided', () => {
            expect(resolveToggleTarget({}, true)).toBe(false);
        });

        it('should support camelCase flag', () => {
            const body = { isFavorite: false };
            expect(resolveToggleTarget(body, true)).toBe(false);
        });
    });
});

// ---- Categorization Tests ----
const {
    CATEGORIES,
    categorizeIngredient,
    getValidCategories
} = require('./utils/categorization');

describe('Ingredient Categorization', () => {
    describe('  categorizeIngredient', () => {
        it('should categorize Tomate as Obst & Gemüse', () => {
            expect(categorizeIngredient('Tomate')).toBe(CATEGORIES.FRUITS_VEGGIES);
        });

        it('should categorize Milch as Milchprodukte', () => {
            expect(categorizeIngredient('Milch')).toBe(CATEGORIES.DAIRY);
        });

        it('should categorize Hähnchen as Fleisch & Fisch', () => {
            expect(categorizeIngredient('Hähnchen')).toBe(CATEGORIES.MEAT_FISH);
        });

        it('should categorize Mehl as Trockenwaren', () => {
            expect(categorizeIngredient('Mehl')).toBe(CATEGORIES.DRY_GOODS);
        });

        it('should categorize Tiefkühl-Spinat as Tiefkühl', () => {
            expect(categorizeIngredient('Tiefkühl-Spinat')).toBe(CATEGORIES.FROZEN);
        });

        it('should categorize Eis as Tiefkühl', () => {
            expect(categorizeIngredient('Eis')).toBe(CATEGORIES.FROZEN);
        });

        it('should return Sonstiges for unknown ingredients', () => {
            expect(categorizeIngredient('xyz123')).toBe(CATEGORIES.OTHER);
        });

        it('should be case insensitive', () => {
            expect(categorizeIngredient('TOMATE')).toBe(CATEGORIES.FRUITS_VEGGIES);
            expect(categorizeIngredient('tomate')).toBe(CATEGORIES.FRUITS_VEGGIES);
        });
    });

    describe('  getValidCategories', () => {
        it('should return 6 categories', () => {
            expect(getValidCategories()).toHaveLength(6);
        });

        it('should contain all category names', () => {
            const categories = getValidCategories();
            expect(categories).toContain('Obst & Gemüse');
            expect(categories).toContain('Milchprodukte');
            expect(categories).toContain('Fleisch & Fisch');
            expect(categories).toContain('Trockenwaren');
            expect(categories).toContain('Tiefkühl');
            expect(categories).toContain('Sonstiges');
        });
    });
});

// ---- Formatting Tests ----
const {
    formatUptime,
    parsePaginationParams,
    buildPaginationMeta
} = require('./utils/formatting');

describe('Formatting Utilities', () => {
    describe('  formatUptime', () => {
        it('should format seconds only', () => {
            expect(formatUptime(45)).toBe('45s');
        });

        it('should format minutes and seconds', () => {
            expect(formatUptime(65)).toBe('1m 5s');
        });

        it('should format hours', () => {
            expect(formatUptime(3665)).toBe('1h 1m 5s');
        });

        it('should format days', () => {
            expect(formatUptime(90061)).toBe('1d 1h 1m 1s');
        });

        it('should handle zero', () => {
            expect(formatUptime(0)).toBe('0s');
        });
    });

    describe('  parsePaginationParams', () => {
        it('should use default values', () => {
            const result = parsePaginationParams({});
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(20);
            expect(result.returnAll).toBe(false);
        });

        it('should parse page number', () => {
            const result = parsePaginationParams({ page: '3' });
            expect(result.page).toBe(3);
            expect(result.offset).toBe(40);
        });

        it('should handle all=true', () => {
            const result = parsePaginationParams({ all: 'true' });
            expect(result.returnAll).toBe(true);
        });

        it('should respect max page size', () => {
            const result = parsePaginationParams({ pageSize: '200' }, 20, 100);
            expect(result.pageSize).toBe(100);
        });
    });

    describe('  buildPaginationMeta', () => {
        it('should build correct metadata', () => {
            const params = { returnAll: false, page: 1, pageSize: 20 };
            const meta = buildPaginationMeta(params, 100);
            expect(meta.totalItems).toBe(100);
            expect(meta.totalPages).toBe(5);
            expect(meta.hasNextPage).toBe(true);
            expect(meta.hasPrevPage).toBe(false);
        });

        it('should handle last page', () => {
            const params = { returnAll: false, page: 5, pageSize: 20 };
            const meta = buildPaginationMeta(params, 100);
            expect(meta.hasNextPage).toBe(false);
            expect(meta.hasPrevPage).toBe(true);
        });
    });
});

// ============ RESULTS ============

console.log('\n' + '='.repeat(50));
console.log(`\nTests: ${passedTests} passed, ${failedTests} failed, ${totalTests} total`);

if (failures.length > 0) {
    console.log(`\n${colors.red}Failures:${colors.reset}`);
    failures.forEach(({ name, error }) => {
        console.log(`  ${colors.red}✕${colors.reset} ${name}`);
        console.log(`    ${colors.dim}${error}${colors.reset}`);
    });
    process.exit(1);
} else {
    console.log(`\n${colors.green}All tests passed!${colors.reset}\n`);
    process.exit(0);
}
