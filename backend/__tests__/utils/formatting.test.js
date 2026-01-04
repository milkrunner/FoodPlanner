/**
 * Formatting utilities tests using Node.js built-in test runner
 * Run with: node --test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
    formatUptime,
    parsePaginationParams,
    buildPaginationMeta
} = require('../../utils/formatting');

describe('Formatting Utilities', () => {
    describe('formatUptime', () => {
        it('should format seconds only', () => {
            assert.strictEqual(formatUptime(45), '45s');
            assert.strictEqual(formatUptime(1), '1s');
        });

        it('should format minutes and seconds', () => {
            assert.strictEqual(formatUptime(65), '1m 5s');
            assert.strictEqual(formatUptime(120), '2m');
            assert.strictEqual(formatUptime(125), '2m 5s');
        });

        it('should format hours, minutes and seconds', () => {
            assert.strictEqual(formatUptime(3665), '1h 1m 5s');
            assert.strictEqual(formatUptime(7200), '2h');
            assert.strictEqual(formatUptime(3600), '1h');
        });

        it('should format days, hours, minutes and seconds', () => {
            assert.strictEqual(formatUptime(90061), '1d 1h 1m 1s');
            assert.strictEqual(formatUptime(86400), '1d');
            assert.strictEqual(formatUptime(172800), '2d');
        });

        it('should handle zero', () => {
            assert.strictEqual(formatUptime(0), '0s');
        });

        it('should skip zero values in middle', () => {
            assert.strictEqual(formatUptime(86401), '1d 1s');
            assert.strictEqual(formatUptime(3601), '1h 1s');
        });
    });

    describe('parsePaginationParams', () => {
        it('should use default values when no params provided', () => {
            const result = parsePaginationParams({});
            assert.deepStrictEqual(result, {
                returnAll: false,
                page: 1,
                pageSize: 20,
                offset: 0
            });
        });

        it('should parse page number', () => {
            const result = parsePaginationParams({ page: '3' });
            assert.strictEqual(result.page, 3);
            assert.strictEqual(result.offset, 40); // (3-1) * 20
        });

        it('should parse page size', () => {
            const result = parsePaginationParams({ pageSize: '50' });
            assert.strictEqual(result.pageSize, 50);
        });

        it('should respect max page size', () => {
            const result = parsePaginationParams({ pageSize: '200' }, 20, 100);
            assert.strictEqual(result.pageSize, 100);
        });

        it('should respect min page size', () => {
            const result = parsePaginationParams({ pageSize: '0' });
            assert.strictEqual(result.pageSize, 1);

            const result2 = parsePaginationParams({ pageSize: '-5' });
            assert.strictEqual(result2.pageSize, 1);
        });

        it('should handle all=true', () => {
            const result = parsePaginationParams({ all: 'true' });
            assert.strictEqual(result.returnAll, true);
            assert.strictEqual(result.pageSize, null);
            assert.strictEqual(result.offset, 0);
        });

        it('should handle all=false', () => {
            const result = parsePaginationParams({ all: 'false' });
            assert.strictEqual(result.returnAll, false);
        });

        it('should enforce minimum page of 1', () => {
            const result = parsePaginationParams({ page: '0' });
            assert.strictEqual(result.page, 1);

            const result2 = parsePaginationParams({ page: '-1' });
            assert.strictEqual(result2.page, 1);
        });

        it('should calculate correct offset', () => {
            assert.strictEqual(parsePaginationParams({ page: '1', pageSize: '10' }).offset, 0);
            assert.strictEqual(parsePaginationParams({ page: '2', pageSize: '10' }).offset, 10);
            assert.strictEqual(parsePaginationParams({ page: '5', pageSize: '25' }).offset, 100);
        });

        it('should use custom defaults', () => {
            const result = parsePaginationParams({}, 50, 200);
            assert.strictEqual(result.pageSize, 50);
        });
    });

    describe('buildPaginationMeta', () => {
        it('should build correct metadata for first page', () => {
            const params = { returnAll: false, page: 1, pageSize: 20 };
            const meta = buildPaginationMeta(params, 100);

            assert.deepStrictEqual(meta, {
                page: 1,
                pageSize: 20,
                totalItems: 100,
                totalPages: 5,
                hasNextPage: true,
                hasPrevPage: false
            });
        });

        it('should build correct metadata for middle page', () => {
            const params = { returnAll: false, page: 3, pageSize: 20 };
            const meta = buildPaginationMeta(params, 100);

            assert.strictEqual(meta.page, 3);
            assert.strictEqual(meta.hasNextPage, true);
            assert.strictEqual(meta.hasPrevPage, true);
        });

        it('should build correct metadata for last page', () => {
            const params = { returnAll: false, page: 5, pageSize: 20 };
            const meta = buildPaginationMeta(params, 100);

            assert.strictEqual(meta.page, 5);
            assert.strictEqual(meta.hasNextPage, false);
            assert.strictEqual(meta.hasPrevPage, true);
        });

        it('should handle returnAll=true', () => {
            const params = { returnAll: true, page: 1, pageSize: null };
            const meta = buildPaginationMeta(params, 100);

            assert.deepStrictEqual(meta, {
                page: 1,
                pageSize: 100,
                totalItems: 100,
                totalPages: 1,
                hasNextPage: false,
                hasPrevPage: false
            });
        });

        it('should handle empty results', () => {
            const params = { returnAll: false, page: 1, pageSize: 20 };
            const meta = buildPaginationMeta(params, 0);

            assert.strictEqual(meta.totalItems, 0);
            assert.strictEqual(meta.totalPages, 0);
            assert.strictEqual(meta.hasNextPage, false);
            assert.strictEqual(meta.hasPrevPage, false);
        });

        it('should calculate totalPages correctly with remainder', () => {
            const params = { returnAll: false, page: 1, pageSize: 20 };
            const meta = buildPaginationMeta(params, 45);

            assert.strictEqual(meta.totalPages, 3); // ceil(45/20) = 3
        });
    });
});
