import { Auth } from '../core/auth.js';
import { Toast } from '../core/toast.js';
import { escapeHtml } from '../core/utils.js';
import { api } from '../core/api.js';

export const AdminUsersView = {
    users: [],
    loading: true,
    sortField: 'created_at',
    sortDir: 'asc',

    render() {
        if (Auth.getUser()?.role !== 'admin') {
            return `<div class="bg-ds-danger-bg border border-ds-danger-border rounded-ds p-6 text-center">
                <p class="text-ds-danger font-medium">Kein Zugriff. Administratorrechte erforderlich.</p>
            </div>`;
        }

        return `
            <div class="space-y-4">
                <div class="flex items-center justify-between flex-wrap gap-2">
                    <h2 class="ds-page-title">Benutzerverwaltung</h2>
                    <div class="flex gap-2">
                        <button id="admin-create-user-btn" class="ds-btn ds-btn-primary ds-btn-sm">
                            + Benutzer anlegen
                        </button>
                        <button id="admin-refresh-btn" class="ds-btn ds-btn-primary ds-btn-sm">
                            Aktualisieren
                        </button>
                    </div>
                </div>
                <div id="admin-users-container">
                    ${this.loading ? this._renderLoading() : this._renderTable()}
                </div>
            </div>
            ${this._renderCreateUserModal()}
            ${this._renderTempPasswordModal()}
        `;
    },

    _renderLoading() {
        return `<div class="animate-pulse space-y-3">
            <div class="h-10 bg-ds-bg-subtle rounded"></div>
            <div class="h-10 bg-ds-bg-subtle rounded"></div>
            <div class="h-10 bg-ds-bg-subtle rounded"></div>
        </div>`;
    },

    _renderTable() {
        if (this.users.length === 0) {
            return `<p class="text-ds-text-muted text-center py-8">Keine Benutzer gefunden.</p>`;
        }

        const sorted = [...this.users].sort((a, b) => {
            let aVal = a[this.sortField], bVal = b[this.sortField];
            if (this.sortField === 'created_at' || this.sortField === 'last_login_at') {
                aVal = aVal ? new Date(aVal).getTime() : 0;
                bVal = bVal ? new Date(bVal).getTime() : 0;
            } else if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = (bVal || '').toLowerCase();
            }
            if (aVal < bVal) return this.sortDir === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        const currentUserId = Auth.getUser()?.id;

        const sortIcon = (field) => {
            if (this.sortField !== field) return '';
            return this.sortDir === 'asc' ? ' ↑' : ' ↓';
        };

        return `
            <div class="overflow-x-auto ds-card">
                <table class="w-full text-sm">
                    <thead class="bg-ds-bg-muted">
                        <tr>
                            <th class="admin-sort-col px-4 py-3 text-left font-medium text-ds-text-sec cursor-pointer hover:text-ds-accent" data-field="name">Name${sortIcon('name')}</th>
                            <th class="admin-sort-col px-4 py-3 text-left font-medium text-ds-text-sec cursor-pointer hover:text-ds-accent" data-field="username">Benutzername${sortIcon('username')}</th>
                            <th class="admin-sort-col px-4 py-3 text-left font-medium text-ds-text-sec cursor-pointer hover:text-ds-accent" data-field="role">Rolle${sortIcon('role')}</th>
                            <th class="admin-sort-col px-4 py-3 text-left font-medium text-ds-text-sec cursor-pointer hover:text-ds-accent" data-field="is_active">Status${sortIcon('is_active')}</th>
                            <th class="admin-sort-col px-4 py-3 text-left font-medium text-ds-text-sec cursor-pointer hover:text-ds-accent" data-field="created_at">Erstellt${sortIcon('created_at')}</th>
                            <th class="admin-sort-col px-4 py-3 text-left font-medium text-ds-text-sec cursor-pointer hover:text-ds-accent" data-field="last_login_at">Letzter Login${sortIcon('last_login_at')}</th>
                            <th class="px-4 py-3 text-left font-medium text-ds-text-sec">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-ds-border">
                        ${sorted.map(user => this._renderRow(user, currentUserId)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    _renderRow(user, currentUserId) {
        const isSelf = user.id === currentUserId;
        const statusBadge = user.is_active
            ? '<span class="ds-badge ds-badge-accent">Aktiv</span>'
            : '<span class="ds-badge" style="--badge-bg: var(--color-red-100); --badge-text: var(--color-red-700);">Deaktiviert</span>';
        const roleBadge = user.role === 'admin'
            ? '<span class="ds-badge ds-badge-accent">Admin</span>'
            : '<span class="ds-badge">User</span>';
        const mustChangeBadge = user.must_change_password
            ? ' <span class="ds-badge">Temp-PW</span>'
            : '';

        const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

        return `
            <tr class="hover:bg-ds-bg-muted ${isSelf ? 'bg-ds-accent-bg/50' : ''}">
                <td class="px-4 py-3 text-ds-text">${escapeHtml(user.name || '—')}${isSelf ? ' <span class="text-xs text-ds-accent">(Du)</span>' : ''}</td>
                <td class="px-4 py-3 text-ds-text-body">${escapeHtml(user.username || '—')}${mustChangeBadge}</td>
                <td class="px-4 py-3">${roleBadge}</td>
                <td class="px-4 py-3">${statusBadge}</td>
                <td class="px-4 py-3 text-ds-text-muted text-xs">${formatDate(user.created_at)}</td>
                <td class="px-4 py-3 text-ds-text-muted text-xs">${formatDate(user.last_login_at)}</td>
                <td class="px-4 py-3">
                    <div class="flex gap-1 flex-wrap">
                        ${isSelf ? '<span class="text-xs text-ds-text-disabled">—</span>' : `
                            <button class="admin-toggle-role ds-badge ds-badge-accent cursor-pointer hover:opacity-80 transition-opacity" data-id="${user.id}" data-current-role="${user.role}">
                                ${user.role === 'admin' ? '→ User' : '→ Admin'}
                            </button>
                            <button class="admin-toggle-status ds-badge cursor-pointer hover:opacity-80 transition-opacity ${user.is_active ? 'bg-ds-danger-bg text-ds-danger' : 'bg-ds-accent-bg text-ds-accent'}" data-id="${user.id}" data-active="${user.is_active}">
                                ${user.is_active ? 'Deaktivieren' : 'Aktivieren'}
                            </button>
                            <button class="admin-reset-pw ds-badge ds-badge-accent cursor-pointer hover:opacity-80 transition-opacity" data-id="${user.id}" data-username="${escapeHtml(user.username || '')}">
                                Passwort
                            </button>
                            <button class="admin-delete-user ds-badge cursor-pointer hover:opacity-80 transition-opacity bg-ds-danger-bg text-ds-danger" data-id="${user.id}" data-username="${escapeHtml(user.username || '')}">
                                Löschen
                            </button>
                        `}
                    </div>
                </td>
            </tr>
        `;
    },

    _renderCreateUserModal() {
        return `
            <div id="admin-create-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div class="ds-card shadow-xl p-6 w-full max-w-sm mx-4">
                    <h3 class="ds-section-title mb-4">Neuen Benutzer anlegen</h3>
                    <p class="text-sm text-ds-text-muted mb-4">Es wird ein temporäres Passwort generiert. Der Benutzer muss es beim ersten Login ändern.</p>
                    <form id="admin-create-form" class="space-y-3">
                        <input id="admin-create-username" type="text" placeholder="Benutzername" required
                            class="ds-input w-full px-3 py-2" />
                        <input id="admin-create-name" type="text" placeholder="Name (optional)"
                            class="ds-input w-full px-3 py-2" />
                        <select id="admin-create-role"
                            class="ds-input w-full px-3 py-2">
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                        <div id="admin-create-error" class="text-sm text-ds-danger hidden"></div>
                        <div class="flex gap-2 justify-end pt-2">
                            <button type="button" id="admin-create-cancel" class="ds-btn ds-btn-secondary ds-btn-sm">Abbrechen</button>
                            <button type="submit" class="ds-btn ds-btn-primary ds-btn-sm">Anlegen</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    _renderTempPasswordModal() {
        return `
            <div id="admin-temppw-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div class="ds-card shadow-xl p-6 w-full max-w-sm mx-4">
                    <h3 class="ds-section-title mb-2">Temporäres Passwort</h3>
                    <p id="admin-temppw-user" class="text-sm text-ds-text-muted mb-4"></p>
                    <div class="flex items-center gap-2 mb-4">
                        <code id="admin-temppw-value" class="flex-1 px-4 py-3 bg-ds-bg-subtle rounded-lg text-lg font-mono text-center text-ds-text tracking-wider select-all"></code>
                        <button id="admin-temppw-copy" class="ds-btn ds-btn-primary px-3 py-3" title="Kopieren">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </button>
                    </div>
                    <p class="text-xs text-ds-text-sec mb-4">Der Benutzer muss dieses Passwort beim ersten Login ändern. Notiere es jetzt -- es wird nicht erneut angezeigt.</p>
                    <div class="flex justify-end">
                        <button id="admin-temppw-close" class="ds-btn ds-btn-secondary ds-btn-sm">Schließen</button>
                    </div>
                </div>
            </div>
        `;
    },

    attachEventListeners() {
        if (Auth.getUser()?.role !== 'admin') return;

        this._loadUsers();

        document.getElementById('admin-refresh-btn')?.addEventListener('click', () => this._loadUsers());
        document.getElementById('admin-create-user-btn')?.addEventListener('click', () => this._showCreateModal());

        // Create user modal
        document.getElementById('admin-create-cancel')?.addEventListener('click', () => {
            document.getElementById('admin-create-modal').classList.add('hidden');
        });
        document.getElementById('admin-create-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'admin-create-modal') e.target.classList.add('hidden');
        });
        document.getElementById('admin-create-form')?.addEventListener('submit', (e) => this._handleCreateUser(e));

        // Temp password modal
        document.getElementById('admin-temppw-close')?.addEventListener('click', () => {
            document.getElementById('admin-temppw-modal').classList.add('hidden');
        });
        document.getElementById('admin-temppw-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'admin-temppw-modal') e.target.classList.add('hidden');
        });
        document.getElementById('admin-temppw-copy')?.addEventListener('click', () => {
            const pw = document.getElementById('admin-temppw-value').textContent;
            navigator.clipboard.writeText(pw).then(() => Toast.show('Kopiert!', { type: 'success', duration: 1500 }));
        });
    },

    _showCreateModal() {
        const modal = document.getElementById('admin-create-modal');
        document.getElementById('admin-create-username').value = '';
        document.getElementById('admin-create-name').value = '';
        document.getElementById('admin-create-role').value = 'user';
        document.getElementById('admin-create-error').classList.add('hidden');
        modal.classList.remove('hidden');
        document.getElementById('admin-create-username').focus();
    },

    _showTempPassword(username, tempPassword) {
        const modal = document.getElementById('admin-temppw-modal');
        document.getElementById('admin-temppw-user').textContent = username;
        document.getElementById('admin-temppw-value').textContent = tempPassword;
        modal.classList.remove('hidden');
    },

    async _handleCreateUser(e) {
        e.preventDefault();
        const errEl = document.getElementById('admin-create-error');
        errEl.classList.add('hidden');

        const username = document.getElementById('admin-create-username').value.trim();
        const name = document.getElementById('admin-create-name').value.trim();
        const role = document.getElementById('admin-create-role').value;

        try {
            const data = await api.post('/admin/users', { username, name: name || undefined, role });
            document.getElementById('admin-create-modal').classList.add('hidden');
            this._showTempPassword(username, data.tempPassword);
            await this._loadUsers();
        } catch (err) {
            errEl.textContent = err.message;
            errEl.classList.remove('hidden');
        }
    },

    _bindTableListeners() {
        // Sort columns
        document.querySelectorAll('.admin-sort-col').forEach(col => {
            col.addEventListener('click', () => {
                const field = col.dataset.field;
                if (this.sortField === field) {
                    this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortField = field;
                    this.sortDir = 'asc';
                }
                this._rerenderTable();
            });
        });

        // Toggle role
        document.querySelectorAll('.admin-toggle-role').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const newRole = btn.dataset.currentRole === 'admin' ? 'user' : 'admin';
                const label = newRole === 'admin' ? 'zum Admin machen' : 'zum User zurückstufen';
                if (!confirm(`Benutzer wirklich ${label}?`)) return;
                await this._apiCall(`/admin/users/${id}/role`, 'PUT', { role: newRole });
            });
        });

        // Toggle status
        document.querySelectorAll('.admin-toggle-status').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const newActive = btn.dataset.active === 'true' ? false : true;
                const label = newActive ? 'aktivieren' : 'deaktivieren';
                if (!confirm(`Benutzer wirklich ${label}?`)) return;
                await this._apiCall(`/admin/users/${id}/status`, 'PUT', { is_active: newActive });
            });
        });

        // Reset password
        document.querySelectorAll('.admin-reset-pw').forEach(btn => {
            btn.addEventListener('click', async () => {
                const username = btn.dataset.username;
                if (!confirm(`Passwort für "${username}" wirklich zurücksetzen? Ein neues temporäres Passwort wird generiert.`)) return;
                try {
                    const data = await api.put(`/admin/users/${btn.dataset.id}/reset-password`, {});
                    this._showTempPassword(username, data.tempPassword);
                    await this._loadUsers();
                } catch (err) {
                    Toast.show(err.message, { type: 'error' });
                }
            });
        });

        // Delete user
        document.querySelectorAll('.admin-delete-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const username = btn.dataset.username;
                if (!confirm(`Benutzer "${username}" wirklich endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
                await this._apiCall(`/admin/users/${btn.dataset.id}`, 'DELETE');
            });
        });
    },

    async _loadUsers() {
        this.loading = true;
        this._rerenderTable();
        try {
            const data = await api.get('/admin/users');
            this.users = data.users;
        } catch (err) {
            Toast.show(err.message, { type: 'error' });
        }
        this.loading = false;
        this._rerenderTable();
    },

    async _apiCall(url, method, body) {
        try {
            const data = await api(url, { method, body });
            Toast.show(data.message || 'Erfolgreich', { type: 'success' });
            await this._loadUsers();
        } catch (err) {
            Toast.show(err.message, { type: 'error' });
        }
    },

    _rerenderTable() {
        const container = document.getElementById('admin-users-container');
        if (container) {
            container.innerHTML = this.loading ? this._renderLoading() : this._renderTable();
            if (!this.loading) this._bindTableListeners();
        }
    }
};
