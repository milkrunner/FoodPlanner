import { AppState, setRenderCallback } from './core/app-state.js';
import { DarkMode } from './core/dark-mode.js';
import { Toast } from './core/toast.js';
import { ActionHistory } from './core/action-history.js';
import { MobileUtils } from './core/mobile-utils.js';
import { OnboardingManager } from './core/onboarding.js';
import { Auth } from './core/auth.js';

const NAV_ICONS = {
    planner: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="4" x2="9" y2="10"/><line x1="15" y1="4" x2="15" y2="10"/></svg>',
    recipes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
    shopping: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
    pantry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    'meal-prep': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
    'ai-recipes': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    parser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
};

const NAV_LABELS = {
    planner: 'Planer', recipes: 'Rezepte', shopping: 'Einkauf',
    pantry: 'Vorrat', history: 'Historie', 'meal-prep': 'Meal Prep',
    'ai-recipes': 'AI Rezepte', parser: 'Import', admin: 'Admin',
};

const BOTTOM_NAV_VIEWS = ['planner', 'recipes', 'shopping', 'pantry', 'history'];

// View module registry for lazy loading
const VIEW_MODULES = {
    'planner':    () => import('./views/week-planner.js'),
    'meal-prep':  () => import('./views/meal-prep.js'),
    'recipes':    () => import('./views/recipe-database.js'),
    'ai-recipes': () => import('./views/ai-recipe-generator.js'),
    'parser':     () => import('./views/recipe-parser.js'),
    'shopping':   () => import('./views/shopping-list.js'),
    'pantry':     () => import('./views/pantry.js'),
    'history':    () => import('./views/cooking-history.js'),
    'admin':      () => import('./views/admin-users.js'),
};

const VIEW_EXPORT_NAMES = {
    'planner':    'WeekPlannerView',
    'meal-prep':  'MealPrepView',
    'recipes':    'RecipeDatabaseView',
    'ai-recipes': 'AIRecipeGeneratorView',
    'parser':     'RecipeParserView',
    'shopping':   'ShoppingListView',
    'pantry':     'PantryView',
    'history':    'CookingHistoryView',
    'admin':      'AdminUsersView',
};

// Main App
export const App = {
    _viewCache: {},

    async init() {
        Auth.init();
        DarkMode.init();
        setRenderCallback(() => App.render());

        if (!Auth.isAuthenticated()) {
            this.render();
            return;
        }

        await this._initAuthenticated();
    },

    async _initAuthenticated() {
        await AppState.init();
        this._loadView('planner');
        this.render();
        this.setupKeyboardShortcuts();
        this.setupMobileFeatures();
        OnboardingManager.init();
    },

    _loadView(viewId) {
        if (!this._viewCache[viewId]) {
            const loader = VIEW_MODULES[viewId];
            if (loader) {
                this._viewCache[viewId] = loader();
            }
        }
        return this._viewCache[viewId];
    },

    async navigateToRecipeDetail(recipeId) {
        AppState.currentView = 'recipes';
        await this.render();
        const module = await this._loadView('recipes');
        if (module) {
            setTimeout(() => module.RecipeDatabaseView.viewRecipe(recipeId), 100);
        }
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', async (e) => {
            // Don't handle shortcuts when typing in inputs
            if (e.target.matches('input, textarea, select')) return;

            // Ctrl+Z or Cmd+Z for undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                ActionHistory.undo();
                return;
            }

            // Number keys 1-8 for view navigation (without modifiers)
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                const views = ['planner', 'meal-prep', 'recipes', 'ai-recipes', 'parser', 'shopping', 'pantry', 'history'];
                const keyNum = parseInt(e.key);
                if (keyNum >= 1 && keyNum <= views.length) {
                    e.preventDefault();
                    AppState.setView(views[keyNum - 1]);
                    return;
                }
            }

            // Escape key to close modals
            if (e.key === 'Escape') {
                // Only check RecipeDatabaseView if it has been loaded
                const recipeModulePromise = this._viewCache['recipes'];
                if (recipeModulePromise) {
                    const module = await recipeModulePromise;
                    if (module.RecipeDatabaseView.viewingRecipe) {
                        module.RecipeDatabaseView.closeRecipeDetail();
                        return;
                    }
                    const recipeFormModal = document.getElementById('recipe-form-modal');
                    if (recipeFormModal?.classList.contains('active')) {
                        module.RecipeDatabaseView.hideRecipeForm();
                        return;
                    }
                }
            }
        });
    },

    setupMobileFeatures() {
        // Reserved for future mobile-specific features (pull-to-refresh, gestures, etc.)
    },

    async render() {
        const appElement = document.getElementById('app');
        if (!appElement) return;

        if (!Auth.isAuthenticated()) {
            appElement.innerHTML = this._renderAuthScreen();
            this._bindAuthScreen();
            return;
        }

        if (Auth.mustChangePassword()) {
            appElement.innerHTML = this._renderChangePasswordScreen();
            this._bindChangePasswordScreen();
            return;
        }

        // Render shell immediately (synchronous) with loading placeholder for view
        appElement.innerHTML = `
            ${this.renderPullToRefresh()}
            <nav class="ds-sidebar" aria-label="Hauptnavigation">
                <div class="ds-sidebar-logo" aria-hidden="true">F</div>
                ${this._renderSidebarItems()}
            </nav>
            <nav class="ds-bottomnav" aria-label="Hauptnavigation">
                ${this._renderBottomNavItems()}
            </nav>
            <main id="main-content" class="sm:ml-[64px] pb-[72px] sm:pb-0">
                <div class="px-5 sm:px-12 py-6 sm:py-10">
                    <div id="view-container" aria-live="polite">${this._renderLoadingPlaceholder()}</div>
                </div>
            </main>
            <div id="toast-notification" class="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 pointer-events-none" aria-live="assertive"></div>
        `;
        this.attachEventListeners();

        // Load and render the current view asynchronously
        try {
            const module = await this._loadView(AppState.currentView);
            const viewName = VIEW_EXPORT_NAMES[AppState.currentView];
            const view = module?.[viewName];
            const viewContainer = document.getElementById('view-container');
            if (viewContainer && view) {
                viewContainer.innerHTML = view.render();
                view.attachEventListeners();
            }
        } catch (err) {
            console.error('[App] Failed to load view module:', AppState.currentView, err);
            const viewContainer = document.getElementById('view-container');
            if (viewContainer) {
                viewContainer.innerHTML = `
                    <div class="bg-ds-danger-bg border border-ds-danger-border rounded-ds p-6 text-center">
                        <p class="text-ds-danger font-medium">Fehler beim Laden der Ansicht.</p>
                        <button onclick="window.location.reload()" class="ds-btn ds-btn-primary mt-3">
                            Seite neu laden
                        </button>
                    </div>`;
            }
        }
    },

    _renderAuthScreen() {
        return `
            <div class="min-h-screen flex items-center justify-center bg-ds-bg-muted px-4">
                <div class="w-full max-w-md">
                    <div class="text-center mb-8">
                        <h1 class="text-4xl font-bold text-ds-text mb-2">Food Planner</h1>
                        <p class="text-ds-text-sec">Dein persönlicher Essenswochenplaner</p>
                    </div>
                    <div class="ds-card">
                        <div id="auth-screen-tabs" class="flex mb-6 bg-ds-bg-subtle rounded-ds p-1">
                            <button class="auth-tab flex-1 py-2 text-sm font-medium rounded-md transition-colors active" data-mode="login">Anmelden</button>
                            <button class="auth-tab flex-1 py-2 text-sm font-medium rounded-md transition-colors" data-mode="register">Registrieren</button>
                        </div>
                        <form id="auth-screen-form" class="space-y-4">
                            <div id="auth-name-field" class="hidden">
                                <input id="auth-screen-name" type="text" placeholder="Name (optional)"
                                    class="ds-input"/>
                            </div>
                            <input id="auth-screen-username" type="text" placeholder="Benutzername" required
                                class="ds-input" autocomplete="username"/>
                            <input id="auth-screen-password" type="password" placeholder="Passwort (Groß-/Kleinbuchstaben + Zahl)" required minlength="8"
                                class="ds-input"/>
                            <div id="auth-screen-error" class="text-sm text-ds-danger hidden"></div>
                            <button type="submit" id="auth-screen-submit"
                                class="ds-btn ds-btn-primary w-full">
                                Anmelden
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;
    },

    _bindAuthScreen() {
        let mode = 'login';
        const tabs = document.querySelectorAll('.auth-tab');
        const nameField = document.getElementById('auth-name-field');
        const submitBtn = document.getElementById('auth-screen-submit');
        const form = document.getElementById('auth-screen-form');
        const errEl = document.getElementById('auth-screen-error');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                mode = tab.dataset.mode;
                tabs.forEach(t => t.classList.toggle('active', t === tab));
                nameField.classList.toggle('hidden', mode === 'login');
                submitBtn.textContent = mode === 'login' ? 'Anmelden' : 'Registrieren';
                errEl.classList.add('hidden');
            });
        });

        // Style active tab
        const style = document.createElement('style');
        style.textContent = '.auth-tab.active { background: white; color: #111; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }';
        document.head.appendChild(style);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errEl.classList.add('hidden');
            const username = document.getElementById('auth-screen-username').value;
            const password = document.getElementById('auth-screen-password').value;
            try {
                if (mode === 'login') {
                    await Auth.login(username, password);
                    if (Auth.mustChangePassword()) {
                        this.render();
                        return;
                    }
                } else {
                    const name = document.getElementById('auth-screen-name')?.value || '';
                    await Auth.register(username, password, name);
                }
                await this._initAuthenticated();
                Toast.show(mode === 'login' ? 'Willkommen zurück!' : 'Erfolgreich registriert!', { type: 'success', duration: 2000 });
            } catch (err) {
                errEl.textContent = err.message;
                errEl.classList.remove('hidden');
            }
        });

        document.getElementById('auth-screen-username')?.focus();
    },

    _renderChangePasswordScreen() {
        return `
            <div class="min-h-screen flex items-center justify-center bg-ds-bg-muted px-4">
                <div class="w-full max-w-md">
                    <div class="text-center mb-8">
                        <h1 class="text-4xl font-bold text-ds-text mb-2">Food Planner</h1>
                        <p class="text-ds-text-sec">Passwort muss geändert werden</p>
                    </div>
                    <div class="ds-card">
                        <div class="flex items-center gap-3 mb-4 p-3 bg-ds-accent-bg border border-ds-border rounded-ds">
                            <svg class="w-5 h-5 text-ds-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                            </svg>
                            <p class="text-sm text-ds-text-body">Du verwendest ein temporäres Passwort. Bitte vergib ein neues eigenes Passwort.</p>
                        </div>
                        <form id="change-pw-form" class="space-y-4">
                            <input id="change-pw-current" type="password" placeholder="Temporäres Passwort" required
                                class="ds-input"/>
                            <input id="change-pw-new" type="password" placeholder="Neues Passwort (Groß-/Kleinbuchstaben + Zahl)" required minlength="8"
                                class="ds-input"/>
                            <input id="change-pw-confirm" type="password" placeholder="Neues Passwort bestätigen" required minlength="8"
                                class="ds-input"/>
                            <div id="change-pw-error" class="text-sm text-ds-danger hidden"></div>
                            <button type="submit" class="ds-btn ds-btn-primary w-full">
                                Passwort ändern
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `;
    },

    _bindChangePasswordScreen() {
        const form = document.getElementById('change-pw-form');
        const errEl = document.getElementById('change-pw-error');

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            errEl.classList.add('hidden');

            const currentPassword = document.getElementById('change-pw-current').value;
            const newPassword = document.getElementById('change-pw-new').value;
            const confirmPassword = document.getElementById('change-pw-confirm').value;

            if (newPassword !== confirmPassword) {
                errEl.textContent = 'Die Passwörter stimmen nicht überein';
                errEl.classList.remove('hidden');
                return;
            }

            if (newPassword.length < 8) {
                errEl.textContent = 'Neues Passwort muss mindestens 8 Zeichen lang sein';
                errEl.classList.remove('hidden');
                return;
            }

            try {
                await Auth.changePassword(currentPassword, newPassword);
                await this._initAuthenticated();
                Toast.show('Passwort erfolgreich geändert!', { type: 'success', duration: 3000 });
            } catch (err) {
                errEl.textContent = err.message;
                errEl.classList.remove('hidden');
            }
        });

        document.getElementById('change-pw-current')?.focus();
    },

    _renderLoadingPlaceholder() {
        return `
            <div class="space-y-4 animate-pulse">
                <div class="h-8 skeleton rounded w-48"></div>
                <div class="h-48 skeleton rounded"></div>
            </div>
        `;
    },

    renderPullToRefresh() {
        return `
            <div class="pull-to-refresh bg-ds-accent text-white">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
            </div>
        `;
    },

    getFavoriteRecipes() {
        return AppState.recipes.filter(recipe => recipe.is_favorite);
    },

    _renderSidebarItems() {
        const tabs = this._getVisibleTabs();
        return tabs.map(viewId => `
            <button class="ds-sidebar-item ${AppState.currentView === viewId ? 'active' : ''}"
                    data-view="${viewId}" title="${NAV_LABELS[viewId]}" aria-label="${NAV_LABELS[viewId]}">
                ${NAV_ICONS[viewId]}
            </button>
        `).join('');
    },

    _renderBottomNavItems() {
        return BOTTOM_NAV_VIEWS.map(viewId => `
            <button class="ds-bottomnav-item ${AppState.currentView === viewId ? 'active' : ''}"
                    data-view="${viewId}" aria-label="${NAV_LABELS[viewId]}">
                ${NAV_ICONS[viewId]}
                <span>${NAV_LABELS[viewId]}</span>
            </button>
        `).join('');
    },

    _getVisibleTabs() {
        const tabs = ['planner', 'recipes', 'shopping', 'pantry', 'history', 'meal-prep', 'ai-recipes', 'parser'];
        if (Auth.getUser()?.role === 'admin') tabs.push('admin');
        return tabs;
    },

    attachEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.ds-sidebar-item[data-view]').forEach(btn => {
            btn.addEventListener('click', () => AppState.setView(btn.dataset.view));
        });
        // Bottom nav
        document.querySelectorAll('.ds-bottomnav-item[data-view]').forEach(btn => {
            btn.addEventListener('click', () => AppState.setView(btn.dataset.view));
        });

        // Pull to refresh setup
        if (MobileUtils.isTouchDevice()) {
            const main = document.querySelector('main');
            if (main) {
                MobileUtils.setupPullToRefresh(main, async () => {
                    await AppState.reloadData();
                    App.render();
                    Toast.success('Daten aktualisiert');
                });
            }
        }
        // Note: view-specific event listeners are called by each view's
        // attachEventListeners() method after the view is rendered asynchronously in render()
    }
};
