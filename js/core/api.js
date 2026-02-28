// Central API client — wraps fetch with auth headers, error handling, JSON parsing
import { Auth } from './auth.js';
import { Toast } from './toast.js';

/**
 * Perform an API request with automatic auth headers and error handling.
 * @param {string} url - The URL to fetch (relative, e.g. '/recipes')
 * @param {object} [options] - fetch options (method, body, headers, etc.)
 * @param {object} [config] - extra config: { raw: true } to skip JSON parsing
 * @returns {Promise<any>} parsed JSON response (or Response if raw)
 */
export async function api(url, options = {}, config = {}) {
    const headers = Auth.authHeaders(options.headers || {});

    // Auto-set Content-Type for object bodies
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'same-origin'
    });

    // 401 Unauthorized → session expired
    if (response.status === 401) {
        Auth.logout();
        window.location.reload();
        throw new ApiError('Sitzung abgelaufen', response.status, response);
    }

    // 429 Too Many Requests → rate limit
    if (response.status === 429) {
        Toast.show('Zu viele Anfragen — bitte kurz warten.', { type: 'error', duration: 5000 });
        throw new ApiError('Rate limit erreicht', response.status, response);
    }

    if (config.raw) return response;

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new ApiError(body.error || `Request failed (${response.status})`, response.status, response);
    }

    // 204 No Content
    if (response.status === 204) return null;

    return response.json();
}

// Convenience methods
api.get = (url) => api(url);
api.post = (url, body) => api(url, { method: 'POST', body });
api.put = (url, body) => api(url, { method: 'PUT', body });
api.delete = (url) => api(url, { method: 'DELETE' });

export class ApiError extends Error {
    constructor(message, status, response) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.response = response;
    }
}
