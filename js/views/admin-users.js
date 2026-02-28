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
            return `<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
                <p class="text-red-700 dark:text-red-300 font-medium">Kein Zugriff. Administratorrechte erforderlich.</p>
            </div>`;
        }

        return `
            <div class="space-y-4">
                <div class="flex items-center justify-between flex-wrap gap-2">
                    <h2 class="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Benutzerverwaltung</h2>
                    <div class="flex gap-2">
                        <button id="admin-create-user-btn" class="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                            + Benutzer anlegen
                        </button>
                        <button id="admin-refresh-btn" class="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
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
            <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>`;
    },

    _renderTable() {
        if (this.users.length === 0) {
            return `<p class="text-gray-500 dark:text-gray-400 text-center py-8">Keine Benutzer gefunden.</p>`;
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
            <div class="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th class="admin-sort-col px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600" data-field="name">Name${sortIcon('name')}</th>
                            <th class="admin-sort-col px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600" data-field="email">E-Mail${sortIcon('email')}</th>
                            <th class="admin-sort-col px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600" data-field="role">Rolle${sortIcon('role')}</th>
                            <th class="admin-sort-col px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600" data-field="is_active">Status${sortIcon('is_active')}</th>
                            <th class="admin-sort-col px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600" data-field="created_at">Erstellt${sortIcon('created_at')}</th>
                            <th class="admin-sort-col px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300 cursor-pointer hover:text-blue-600" data-field="last_login_at">Letzter Login${sortIcon('last_login_at')}</th>
                            <th class="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Aktionen</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                        ${sorted.map(user => this._renderRow(user, currentUserId)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    _renderRow(user, currentUserId) {
        const isSelf = user.id === currentUserId;
        const statusBadge = user.is_active
            ? '<span class="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Aktiv</span>'
            : '<span class="px-2 py-1 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">Deaktiviert</span>';
        const roleBadge = user.role === 'admin'
            ? '<span class="px-2 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">Admin</span>'
            : '<span class="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">User</span>';
        const mustChangeBadge = user.must_change_password
            ? ' <span class="px-1.5 py-0.5 text-[10px] rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">Temp-PW</span>'
            : '';

        const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-750 ${isSelf ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}">
                <td class="px-4 py-3 text-gray-900 dark:text-white">${escapeHtml(user.name || '—')}${isSelf ? ' <span class="text-xs text-blue-500">(Du)</span>' : ''}</td>
                <td class="px-4 py-3 text-gray-600 dark:text-gray-300">${escapeHtml(user.email)}${mustChangeBadge}</td>
                <td class="px-4 py-3">${roleBadge}</td>
                <td class="px-4 py-3">${statusBadge}</td>
                <td class="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">${formatDate(user.created_at)}</td>
                <td class="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">${formatDate(user.last_login_at)}</td>
                <td class="px-4 py-3">
                    <div class="flex gap-1 flex-wrap">
                        ${isSelf ? '<span class="text-xs text-gray-400">—</span>' : `
                            <button class="admin-toggle-role px-2 py-1 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors" data-id="${user.id}" data-current-role="${user.role}">
                                ${user.role === 'admin' ? '→ User' : '→ Admin'}
                            </button>
                            <button class="admin-toggle-status px-2 py-1 text-xs rounded ${user.is_active ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200'} transition-colors" data-id="${user.id}" data-active="${user.is_active}">
                                ${user.is_active ? 'Deaktivieren' : 'Aktivieren'}
                            </button>
                            <button class="admin-reset-pw px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors" data-id="${user.id}" data-email="${escapeHtml(user.email)}">
                                Passwort
                            </button>
                            <button class="admin-delete-user px-2 py-1 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors" data-id="${user.id}" data-email="${escapeHtml(user.email)}">
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
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Neuen Benutzer anlegen</h3>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Es wird ein temporäres Passwort generiert. Der Benutzer muss es beim ersten Login ändern.</p>
                    <form id="admin-create-form" class="space-y-3">
                        <input id="admin-create-email" type="email" placeholder="E-Mail-Adresse" required
                            class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <input id="admin-create-name" type="text" placeholder="Name (optional)"
                            class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <select id="admin-create-role"
                            class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                        <div id="admin-create-error" class="text-sm text-red-500 hidden"></div>
                        <div class="flex gap-2 justify-end pt-2">
                            <button type="button" id="admin-create-cancel" class="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Abbrechen</button>
                            <button type="submit" class="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">Anlegen</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    _renderTempPasswordModal() {
        return `
            <div id="admin-temppw-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Temporäres Passwort</h3>
                    <p id="admin-temppw-email" class="text-sm text-gray-500 dark:text-gray-400 mb-4"></p>
                    <div class="flex items-center gap-2 mb-4">
                        <code id="admin-temppw-value" class="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-lg font-mono text-center text-gray-900 dark:text-white tracking-wider select-all"></code>
                        <button id="admin-temppw-copy" class="px-3 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" title="Kopieren">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </button>
                    </div>
                    <p class="text-xs text-yellow-600 dark:text-yellow-400 mb-4">Der Benutzer muss dieses Passwort beim ersten Login ändern. Notiere es jetzt — es wird nicht erneut angezeigt.</p>
                    <div class="flex justify-end">
                        <button id="admin-temppw-close" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">Schließen</button>
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
        document.getElementById('admin-create-email').value = '';
        document.getElementById('admin-create-name').value = '';
        document.getElementById('admin-create-role').value = 'user';
        document.getElementById('admin-create-error').classList.add('hidden');
        modal.classList.remove('hidden');
        document.getElementById('admin-create-email').focus();
    },

    _showTempPassword(email, tempPassword) {
        const modal = document.getElementById('admin-temppw-modal');
        document.getElementById('admin-temppw-email').textContent = email;
        document.getElementById('admin-temppw-value').textContent = tempPassword;
        modal.classList.remove('hidden');
    },

    async _handleCreateUser(e) {
        e.preventDefault();
        const errEl = document.getElementById('admin-create-error');
        errEl.classList.add('hidden');

        const email = document.getElementById('admin-create-email').value.trim();
        const name = document.getElementById('admin-create-name').value.trim();
        const role = document.getElementById('admin-create-role').value;

        try {
            const data = await api.post('/admin/users', { email, name: name || undefined, role });
            document.getElementById('admin-create-modal').classList.add('hidden');
            this._showTempPassword(email, data.tempPassword);
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
                const email = btn.dataset.email;
                if (!confirm(`Passwort für "${email}" wirklich zurücksetzen? Ein neues temporäres Passwort wird generiert.`)) return;
                try {
                    const data = await api.put(`/admin/users/${btn.dataset.id}/reset-password`, {});
                    this._showTempPassword(email, data.tempPassword);
                    await this._loadUsers();
                } catch (err) {
                    Toast.show(err.message, { type: 'error' });
                }
            });
        });

        // Delete user
        document.querySelectorAll('.admin-delete-user').forEach(btn => {
            btn.addEventListener('click', async () => {
                const email = btn.dataset.email;
                if (!confirm(`Benutzer "${email}" wirklich endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
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
