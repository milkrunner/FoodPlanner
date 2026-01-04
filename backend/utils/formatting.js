/**
 * Formatting utilities
 */

/**
 * Format uptime in seconds to human-readable string
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime string (e.g., "2d 5h 30m 15s")
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
}

/**
 * Parse pagination parameters from request query
 * @param {object} query - Request query object
 * @param {number} defaultPageSize - Default page size
 * @param {number} maxPageSize - Maximum allowed page size
 * @returns {object} Parsed pagination parameters
 */
function parsePaginationParams(query, defaultPageSize = 20, maxPageSize = 100) {
    const returnAll = query.all === 'true';
    const page = Math.max(1, parseInt(query.page) || 1);
    const pageSize = returnAll ? null : Math.min(maxPageSize, Math.max(1, parseInt(query.pageSize) || defaultPageSize));
    const offset = returnAll ? 0 : (page - 1) * pageSize;

    return {
        returnAll,
        page,
        pageSize,
        offset
    };
}

/**
 * Build pagination metadata for response
 * @param {object} params - Pagination parameters
 * @param {number} totalItems - Total number of items
 * @returns {object} Pagination metadata
 */
function buildPaginationMeta(params, totalItems) {
    const { returnAll, page, pageSize } = params;

    return {
        page: returnAll ? 1 : page,
        pageSize: returnAll ? totalItems : pageSize,
        totalItems,
        totalPages: returnAll ? 1 : Math.ceil(totalItems / pageSize),
        hasNextPage: returnAll ? false : page * pageSize < totalItems,
        hasPrevPage: returnAll ? false : page > 1
    };
}

module.exports = {
    formatUptime,
    parsePaginationParams,
    buildPaginationMeta
};
