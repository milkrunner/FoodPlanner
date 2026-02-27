// Client-side authentication module (JWT + localStorage)

const TOKEN_REFRESH_INTERVAL = 12 * 60 * 1000; // 12 minutes (access token lives 15min)

export const Auth = {
    _token: null,
    _refreshToken: null,
    _user: null,
    _mustChangePassword: false,
    _refreshTimer: null,

    init() {
        this._token = localStorage.getItem('auth_token');
        this._refreshToken = localStorage.getItem('auth_refresh_token');
        const stored = localStorage.getItem('auth_user');
        if (stored) {
            try { this._user = JSON.parse(stored); } catch { this._user = null; }
        }
        this._mustChangePassword = localStorage.getItem('auth_must_change') === 'true';

        if (this._refreshToken) {
            this._startRefreshTimer();
        }
    },

    isAuthenticated() {
        return !!this._token;
    },

    mustChangePassword() {
        return this._mustChangePassword;
    },

    getUser() {
        return this._user;
    },

    getToken() {
        return this._token;
    },

    _save(token, refreshToken, user, mustChange = false) {
        this._token = token;
        this._refreshToken = refreshToken;
        this._user = user;
        this._mustChangePassword = mustChange;
        localStorage.setItem('auth_token', token);
        if (refreshToken) localStorage.setItem('auth_refresh_token', refreshToken);
        localStorage.setItem('auth_user', JSON.stringify(user));
        if (mustChange) {
            localStorage.setItem('auth_must_change', 'true');
        } else {
            localStorage.removeItem('auth_must_change');
        }
        this._startRefreshTimer();
    },

    _clear() {
        this._token = null;
        this._refreshToken = null;
        this._user = null;
        this._mustChangePassword = false;
        this._stopRefreshTimer();
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_refresh_token');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_must_change');
    },

    _startRefreshTimer() {
        this._stopRefreshTimer();
        this._refreshTimer = setInterval(() => this._refreshAccessToken(), TOKEN_REFRESH_INTERVAL);
    },

    _stopRefreshTimer() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = null;
        }
    },

    async _refreshAccessToken() {
        if (!this._refreshToken) return;
        try {
            const res = await fetch('/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: this._refreshToken })
            });
            if (!res.ok) {
                this._clear();
                window.location.reload();
                return;
            }
            const data = await res.json();
            this._token = data.token;
            this._user = data.user;
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('auth_user', JSON.stringify(data.user));
        } catch {
            // Network error — don't logout, retry next interval
        }
    },

    async login(email, password) {
        const res = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Anmeldung fehlgeschlagen');
        this._save(data.token, data.refreshToken, data.user, data.mustChangePassword || false);
        return data.user;
    },

    async register(email, password, name) {
        const res = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, name })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registrierung fehlgeschlagen');
        this._save(data.token, data.refreshToken, data.user);
        return data.user;
    },

    async changePassword(currentPassword, newPassword) {
        const res = await fetch('/auth/change-password', {
            method: 'POST',
            headers: this.authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Passwort ändern fehlgeschlagen');
        this._mustChangePassword = false;
        localStorage.removeItem('auth_must_change');
        return data;
    },

    authHeaders(extra = {}) {
        return this._token ? { ...extra, 'Authorization': `Bearer ${this._token}` } : extra;
    },

    async logout() {
        try {
            await fetch('/auth/logout', {
                method: 'POST',
                headers: this._token ? { 'Authorization': `Bearer ${this._token}` } : {}
            });
        } catch { /* ignore */ }
        this._clear();
    }
};
