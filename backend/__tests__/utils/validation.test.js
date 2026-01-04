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
            expect(validateUrl(url)).toBe(url);
        });

        it('should accept valid allrecipes.com URLs', () => {
            const url = 'https://www.allrecipes.com/recipe/12345/spaghetti';
            expect(validateUrl(url)).toBe(url);
        });

        it('should accept HTTP URLs from allowed domains', () => {
            const url = 'http://chefkoch.de/rezepte/12345';
            expect(validateUrl(url)).toBe(url);
        });

        it('should reject invalid URL format', () => {
            expect(() => validateUrl('not-a-url')).toThrow('Invalid URL format');
        });

        it('should reject non-HTTP/HTTPS protocols', () => {
            expect(() => validateUrl('ftp://chefkoch.de/file')).toThrow('Only HTTP and HTTPS protocols are allowed');
            expect(() => validateUrl('file:///etc/passwd')).toThrow('Only HTTP and HTTPS protocols are allowed');
            expect(() => validateUrl('javascript:alert(1)')).toThrow('Invalid URL format');
        });

        it('should reject domains not in allowlist', () => {
            expect(() => validateUrl('https://evil.com/malware')).toThrow('not in the list of allowed');
            expect(() => validateUrl('https://localhost/admin')).toThrow('not in the list of allowed');
            expect(() => validateUrl('https://192.168.1.1/internal')).toThrow('not in the list of allowed');
            expect(() => validateUrl('https://127.0.0.1:8080/api')).toThrow('not in the list of allowed');
        });

        it('should reject internal/private IP addresses', () => {
            expect(() => validateUrl('http://10.0.0.1/secret')).toThrow('not in the list of allowed');
            expect(() => validateUrl('http://172.16.0.1/admin')).toThrow('not in the list of allowed');
        });

        it('should handle URLs with query parameters', () => {
            const url = 'https://www.chefkoch.de/rezepte/12345?print=true&lang=de';
            expect(validateUrl(url)).toBe(url);
        });

        it('should handle URLs with fragments', () => {
            const url = 'https://www.chefkoch.de/rezepte/12345#ingredients';
            expect(validateUrl(url)).toBe(url);
        });
    });

    describe('ALLOWED_RECIPE_DOMAINS', () => {
        it('should contain expected German recipe sites', () => {
            expect(ALLOWED_RECIPE_DOMAINS).toContain('chefkoch.de');
            expect(ALLOWED_RECIPE_DOMAINS).toContain('www.chefkoch.de');
            expect(ALLOWED_RECIPE_DOMAINS).toContain('eatsmarter.de');
            expect(ALLOWED_RECIPE_DOMAINS).toContain('lecker.de');
        });

        it('should contain expected international recipe sites', () => {
            expect(ALLOWED_RECIPE_DOMAINS).toContain('allrecipes.com');
            expect(ALLOWED_RECIPE_DOMAINS).toContain('bbcgoodfood.com');
            expect(ALLOWED_RECIPE_DOMAINS).toContain('epicurious.com');
        });

        it('should have both www and non-www versions', () => {
            const nonWwwDomains = ALLOWED_RECIPE_DOMAINS.filter(d => !d.startsWith('www.'));
            nonWwwDomains.forEach(domain => {
                expect(ALLOWED_RECIPE_DOMAINS).toContain(`www.${domain}`);
            });
        });
    });
});

describe('Video URL Validation', () => {
    describe('isVideoUrl', () => {
        it('should recognize TikTok URLs', () => {
            expect(isVideoUrl('https://www.tiktok.com/@user/video/123')).toBe(true);
            expect(isVideoUrl('https://vm.tiktok.com/abc123')).toBe(true);
            expect(isVideoUrl('http://tiktok.com/video')).toBe(true);
        });

        it('should recognize Instagram Reels', () => {
            expect(isVideoUrl('https://www.instagram.com/reel/ABC123')).toBe(true);
            expect(isVideoUrl('https://instagram.com/reel/XYZ789')).toBe(true);
            expect(isVideoUrl('https://www.instagram.com/p/POST123')).toBe(true);
        });

        it('should recognize Pinterest pins', () => {
            expect(isVideoUrl('https://www.pinterest.com/pin/123456')).toBe(true);
            expect(isVideoUrl('https://pinterest.de/pin/789')).toBe(true);
        });

        it('should recognize YouTube Shorts', () => {
            expect(isVideoUrl('https://www.youtube.com/shorts/ABC123')).toBe(true);
            expect(isVideoUrl('https://youtube.com/shorts/XYZ')).toBe(true);
            expect(isVideoUrl('https://youtu.be/shortid')).toBe(true);
        });

        it('should reject non-video URLs', () => {
            expect(isVideoUrl('https://www.google.com')).toBe(false);
            expect(isVideoUrl('https://chefkoch.de/rezepte')).toBe(false);
            expect(isVideoUrl('https://instagram.com/profile')).toBe(false);
            expect(isVideoUrl('https://youtube.com/watch?v=123')).toBe(false);
        });
    });

    describe('sanitizeVideoUrl', () => {
        it('should return sanitized URL for valid video URLs', () => {
            const url = 'https://www.tiktok.com/@user/video/123';
            expect(sanitizeVideoUrl(url)).toBe(url);
        });

        it('should return null for invalid URLs', () => {
            expect(sanitizeVideoUrl('not-a-url')).toBeNull();
            expect(sanitizeVideoUrl('')).toBeNull();
        });

        it('should return null for non-HTTP protocols', () => {
            expect(sanitizeVideoUrl('ftp://tiktok.com/video')).toBeNull();
            expect(sanitizeVideoUrl('file:///video.mp4')).toBeNull();
        });

        it('should return null for non-video platform URLs', () => {
            expect(sanitizeVideoUrl('https://evil.com/malware')).toBeNull();
            expect(sanitizeVideoUrl('https://localhost:8080/api')).toBeNull();
        });

        it('should prevent command injection attempts', () => {
            expect(sanitizeVideoUrl('https://tiktok.com/; rm -rf /')).toBeNull();
            expect(sanitizeVideoUrl('https://tiktok.com/`whoami`')).toBeNull();
            expect(sanitizeVideoUrl('$(curl evil.com)')).toBeNull();
        });
    });

    describe('getVideoPlatform', () => {
        it('should identify TikTok', () => {
            expect(getVideoPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
            expect(getVideoPlatform('https://vm.tiktok.com/abc')).toBe('tiktok');
        });

        it('should identify Instagram', () => {
            expect(getVideoPlatform('https://www.instagram.com/reel/ABC')).toBe('instagram');
        });

        it('should identify Pinterest', () => {
            expect(getVideoPlatform('https://pinterest.com/pin/123')).toBe('pinterest');
        });

        it('should identify YouTube', () => {
            expect(getVideoPlatform('https://youtube.com/shorts/abc')).toBe('youtube');
            expect(getVideoPlatform('https://youtu.be/xyz')).toBe('youtube');
        });

        it('should return unknown for unrecognized URLs', () => {
            expect(getVideoPlatform('https://google.com')).toBe('unknown');
            expect(getVideoPlatform('invalid')).toBe('unknown');
        });
    });
});
