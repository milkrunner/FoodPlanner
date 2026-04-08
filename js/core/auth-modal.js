// Login/Register modal overlay
import { Auth } from './auth.js';
import { Toast } from './toast.js';
import { escapeHtml } from './utils.js';

export const AuthModal = {
    _overlay: null,
    _onSuccess: null,

    show(mode = 'login', onSuccess) {
        this.close();
        this._onSuccess = onSuccess || null;
        const isLogin = mode === 'login';

        const overlay = document.createElement('div');
        overlay.id = 'auth-modal-overlay';
        overlay.className = 'modal active';
        overlay.innerHTML = `
            <div class="w-full max-w-sm mx-4 relative">
                <button id="auth-modal-close" class="absolute top-3 right-3 ds-text-muted hover:text-[#333] transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                <h2 class="ds-page-title mb-4">${isLogin ? 'Anmelden' : 'Registrieren'}</h2>
                <form id="auth-modal-form" class="space-y-3">
                    ${!isLogin ? '<input id="auth-name" type="text" placeholder="Name (optional)" class="ds-input"/>' : ''}
                    <input id="auth-username" type="text" placeholder="Benutzername" required class="ds-input" autocomplete="username"/>
                    <input id="auth-password" type="password" placeholder="Passwort" required minlength="8" class="ds-input"/>
                    <div id="auth-error" class="text-xs text-ds-danger hidden"></div>
                    <button type="submit" class="ds-btn ds-btn-primary w-full">${isLogin ? 'Anmelden' : 'Registrieren'}</button>
                </form>
                <p class="text-xs text-center text-[#999] mt-3">
                    ${isLogin ? 'Noch kein Konto?' : 'Bereits registriert?'}
                    <button id="auth-toggle-mode" class="text-ds-accent hover:underline ml-1">${isLogin ? 'Registrieren' : 'Anmelden'}</button>
                </p>
            </div>`;

        document.body.appendChild(overlay);
        this._overlay = overlay;

        overlay.querySelector('#auth-modal-close').addEventListener('click', () => this.close());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) this.close(); });
        overlay.querySelector('#auth-toggle-mode').addEventListener('click', () => this.show(isLogin ? 'register' : 'login', this._onSuccess));

        overlay.querySelector('#auth-modal-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = overlay.querySelector('#auth-username').value;
            const password = overlay.querySelector('#auth-password').value;
            const errEl = overlay.querySelector('#auth-error');
            errEl.classList.add('hidden');
            try {
                if (isLogin) {
                    await Auth.login(username, password);
                } else {
                    const name = overlay.querySelector('#auth-name')?.value || '';
                    await Auth.register(username, password, name);
                }
                this.close();
                if (this._onSuccess) this._onSuccess();
                Toast.show(isLogin ? 'Willkommen zurück!' : 'Erfolgreich registriert!', { type: 'success', duration: 2000 });
            } catch (err) {
                errEl.textContent = err.message;
                errEl.classList.remove('hidden');
            }
        });

        overlay.querySelector('#auth-username').focus();
    },

    close() {
        if (this._overlay) {
            this._overlay.remove();
            this._overlay = null;
        }
    }
};
