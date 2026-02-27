// Client-side authentication module (JWT + localStorage)

export const Auth = {
    _token: null,
    _user: null,

    init() {
        this._token = localStorage.getItem('auth_token');
        const stored = localStorage.getItem('auth_user');
        if (stored) {
            try { this._user = JSON.parse(stored); } catch { this._user = null; }
        }
    },

    isAuthenticated() {
        return !!this._token;
    },

    getUser() {
        return this._user;
    },

    getToken() {
        return this._token;
    },

    _save(token, user) {
        this._token = token;
        this._user = user;
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
    },

    _clear() {
        this._token = null;
        this._user = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    },

    async login(email, password) {
        const res = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Anmeldung fehlgeschlagen');
        this._save(data.token, data.user);
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
        this._save(data.token, data.user);
        return data.user;
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
