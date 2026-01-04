const {
    formatUptime,
    parsePaginationParams,
    buildPaginationMeta
} = require('../../utils/formatting');

describe('Formatting Utilities', () => {
    describe('formatUptime', () => {
        it('should format seconds only', () => {
            expect(formatUptime(45)).toBe('45s');
            expect(formatUptime(1)).toBe('1s');
        });

        it('should format minutes and seconds', () => {
            expect(formatUptime(65)).toBe('1m 5s');
            expect(formatUptime(120)).toBe('2m');
            expect(formatUptime(125)).toBe('2m 5s');
        });

        it('should format hours, minutes and seconds', () => {
            expect(formatUptime(3665)).toBe('1h 1m 5s');
            expect(formatUptime(7200)).toBe('2h');
            expect(formatUptime(3600)).toBe('1h');
        });

        it('should format days, hours, minutes and seconds', () => {
            expect(formatUptime(90061)).toBe('1d 1h 1m 1s');
            expect(formatUptime(86400)).toBe('1d');
            expect(formatUptime(172800)).toBe('2d');
        });

        it('should handle zero', () => {
            expect(formatUptime(0)).toBe('0s');
        });

        it('should skip zero values in middle', () => {
            expect(formatUptime(86401)).toBe('1d 1s');
            expect(formatUptime(3601)).toBe('1h 1s');
        });
    });

    describe('parsePaginationParams', () => {
        it('should use default values when no params provided', () => {
            const result = parsePaginationParams({});
            expect(result).toEqual({
                returnAll: false,
                page: 1,
                pageSize: 20,
                offset: 0
            });
        });

        it('should parse page number', () => {
            const result = parsePaginationParams({ page: '3' });
            expect(result.page).toBe(3);
            expect(result.offset).toBe(40); // (3-1) * 20
        });

        it('should parse page size', () => {
            const result = parsePaginationParams({ pageSize: '50' });
            expect(result.pageSize).toBe(50);
        });

        it('should respect max page size', () => {
            const result = parsePaginationParams({ pageSize: '200' }, 20, 100);
            expect(result.pageSize).toBe(100);
        });

        it('should respect min page size', () => {
            const result = parsePaginationParams({ pageSize: '0' });
            expect(result.pageSize).toBe(1);

            const result2 = parsePaginationParams({ pageSize: '-5' });
            expect(result2.pageSize).toBe(1);
        });

        it('should handle all=true', () => {
            const result = parsePaginationParams({ all: 'true' });
            expect(result.returnAll).toBe(true);
            expect(result.pageSize).toBeNull();
            expect(result.offset).toBe(0);
        });

        it('should handle all=false', () => {
            const result = parsePaginationParams({ all: 'false' });
            expect(result.returnAll).toBe(false);
        });

        it('should enforce minimum page of 1', () => {
            const result = parsePaginationParams({ page: '0' });
            expect(result.page).toBe(1);

            const result2 = parsePaginationParams({ page: '-1' });
            expect(result2.page).toBe(1);
        });

        it('should calculate correct offset', () => {
            expect(parsePaginationParams({ page: '1', pageSize: '10' }).offset).toBe(0);
            expect(parsePaginationParams({ page: '2', pageSize: '10' }).offset).toBe(10);
            expect(parsePaginationParams({ page: '5', pageSize: '25' }).offset).toBe(100);
        });

        it('should use custom defaults', () => {
            const result = parsePaginationParams({}, 50, 200);
            expect(result.pageSize).toBe(50);
        });
    });

    describe('buildPaginationMeta', () => {
        it('should build correct metadata for first page', () => {
            const params = { returnAll: false, page: 1, pageSize: 20 };
            const meta = buildPaginationMeta(params, 100);

            expect(meta).toEqual({
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

            expect(meta.page).toBe(3);
            expect(meta.hasNextPage).toBe(true);
            expect(meta.hasPrevPage).toBe(true);
        });

        it('should build correct metadata for last page', () => {
            const params = { returnAll: false, page: 5, pageSize: 20 };
            const meta = buildPaginationMeta(params, 100);

            expect(meta.page).toBe(5);
            expect(meta.hasNextPage).toBe(false);
            expect(meta.hasPrevPage).toBe(true);
        });

        it('should handle returnAll=true', () => {
            const params = { returnAll: true, page: 1, pageSize: null };
            const meta = buildPaginationMeta(params, 100);

            expect(meta).toEqual({
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

            expect(meta.totalItems).toBe(0);
            expect(meta.totalPages).toBe(0);
            expect(meta.hasNextPage).toBe(false);
            expect(meta.hasPrevPage).toBe(false);
        });

        it('should calculate totalPages correctly with remainder', () => {
            const params = { returnAll: false, page: 1, pageSize: 20 };
            const meta = buildPaginationMeta(params, 45);

            expect(meta.totalPages).toBe(3); // ceil(45/20) = 3
        });
    });
});
