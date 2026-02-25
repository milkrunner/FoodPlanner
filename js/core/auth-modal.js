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
        overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/50';
        overlay.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 relative">
                <button id="auth-modal-close" class="absolute top-3 right-3 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">${isLogin ? 'Anmelden' : 'Registrieren'}</h2>
                <form id="auth-modal-form" class="space-y-3">
                    ${!isLogin ? '<input id="auth-name" type="text" placeholder="Name (optional)" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"/>' : ''}
                    <input id="auth-email" type="email" placeholder="E-Mail" required class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    <input id="auth-password" type="password" placeholder="Passwort" required minlength="8" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                    <div id="auth-error" class="text-xs text-red-500 hidden"></div>
                    <button type="submit" class="w-full py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">${isLogin ? 'Anmelden' : 'Registrieren'}</button>
                </form>
                <p class="text-xs text-center text-gray-400 dark:text-gray-500 mt-3">
                    ${isLogin ? 'Noch kein Konto?' : 'Bereits registriert?'}
                    <button id="auth-toggle-mode" class="text-blue-600 dark:text-blue-400 hover:underline ml-1">${isLogin ? 'Registrieren' : 'Anmelden'}</button>
                </p>
            </div>`;

        document.body.appendChild(overlay);
        this._overlay = overlay;

        overlay.querySelector('#auth-modal-close').addEventListener('click', () => this.close());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) this.close(); });
        overlay.querySelector('#auth-toggle-mode').addEventListener('click', () => this.show(isLogin ? 'register' : 'login', this._onSuccess));

        overlay.querySelector('#auth-modal-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = overlay.querySelector('#auth-email').value;
            const password = overlay.querySelector('#auth-password').value;
            const errEl = overlay.querySelector('#auth-error');
            errEl.classList.add('hidden');
            try {
                if (isLogin) {
                    await Auth.login(email, password);
                } else {
                    const name = overlay.querySelector('#auth-name')?.value || '';
                    await Auth.register(email, password, name);
                }
                this.close();
                if (this._onSuccess) this._onSuccess();
                Toast.show(isLogin ? 'Willkommen zurück!' : 'Erfolgreich registriert!', { type: 'success', duration: 2000 });
            } catch (err) {
                errEl.textContent = err.message;
                errEl.classList.remove('hidden');
            }
        });

        overlay.querySelector('#auth-email').focus();
    },

    close() {
        if (this._overlay) {
            this._overlay.remove();
            this._overlay = null;
        }
    }
};
