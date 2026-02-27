import { AppState, setRenderCallback } from './core/app-state.js';
import { DarkMode } from './core/dark-mode.js';
import { Toast } from './core/toast.js';
import { ActionHistory } from './core/action-history.js';
import { MobileUtils } from './core/mobile-utils.js';
import { OnboardingManager } from './core/onboarding.js';
import { Auth } from './core/auth.js';
import { AuthModal } from './core/auth-modal.js';
import { escapeHtml } from './core/utils.js';

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
    mobileMenuOpen: false,
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
        // Handle resize events
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (!MobileUtils.isMobile() && this.mobileMenuOpen) {
                    this.closeMobileMenu();
                }
            }, 100);
        });

        // Close mobile menu on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.mobileMenuOpen) {
                this.closeMobileMenu();
            }
        });
    },

    toggleMobileMenu() {
        this.mobileMenuOpen = !this.mobileMenuOpen;
        const overlay = document.querySelector('.mobile-nav-overlay');
        const menu = document.querySelector('.mobile-nav-menu');

        if (overlay && menu) {
            overlay.classList.toggle('active', this.mobileMenuOpen);
            menu.classList.toggle('active', this.mobileMenuOpen);
            document.body.style.overflow = this.mobileMenuOpen ? 'hidden' : '';
        }
    },

    closeMobileMenu() {
        this.mobileMenuOpen = false;
        const overlay = document.querySelector('.mobile-nav-overlay');
        const menu = document.querySelector('.mobile-nav-menu');

        if (overlay && menu) {
            overlay.classList.remove('active');
            menu.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    async render() {
        const appElement = document.getElementById('app');
        if (!appElement) return;

        if (!Auth.isAuthenticated()) {
            appElement.innerHTML = this._renderAuthScreen();
            this._bindAuthScreen();
            return;
        }

        // Render shell immediately (synchronous) with loading placeholder for view
        appElement.innerHTML = `
            ${this.renderPullToRefresh()}
            ${this.renderHeader()}
            ${this.renderMobileNavigation()}
            ${this.renderNavigation()}
            <main id="main-content" class="container mx-auto px-4 py-4 sm:py-6 pb-safe" role="main" aria-label="Hauptinhalt">
                <div id="view-container" aria-live="polite">${this._renderLoadingPlaceholder()}</div>
            </main>
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
                    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
                        <p class="text-red-700 dark:text-red-300 font-medium">Fehler beim Laden der Ansicht.</p>
                        <button onclick="window.location.reload()" class="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                            Seite neu laden
                        </button>
                    </div>`;
            }
        }
    },

    _renderAuthScreen() {
        const isDark = document.documentElement.classList.contains('dark');
        return `
            <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
                <div class="w-full max-w-md">
                    <div class="text-center mb-8">
                        <h1 class="text-4xl font-bold text-gray-800 dark:text-white mb-2">Food Planner</h1>
                        <p class="text-gray-600 dark:text-gray-400">Dein persönlicher Essenswochenplaner</p>
                    </div>
                    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
                        <div id="auth-screen-tabs" class="flex mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                            <button class="auth-tab flex-1 py-2 text-sm font-medium rounded-md transition-colors active" data-mode="login">Anmelden</button>
                            <button class="auth-tab flex-1 py-2 text-sm font-medium rounded-md transition-colors" data-mode="register">Registrieren</button>
                        </div>
                        <form id="auth-screen-form" class="space-y-4">
                            <div id="auth-name-field" class="hidden">
                                <input id="auth-screen-name" type="text" placeholder="Name (optional)"
                                    class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                            </div>
                            <input id="auth-screen-email" type="email" placeholder="E-Mail" required
                                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                            <input id="auth-screen-password" type="password" placeholder="Passwort (min. 8 Zeichen)" required minlength="8"
                                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                            <div id="auth-screen-error" class="text-sm text-red-500 hidden"></div>
                            <button type="submit" id="auth-screen-submit"
                                class="w-full py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors">
                                Anmelden
                            </button>
                        </form>
                    </div>
                    <div class="flex justify-center mt-4">
                        <button id="auth-dark-toggle" class="p-2 rounded-lg bg-white/50 dark:bg-gray-700/50 hover:bg-white dark:hover:bg-gray-600 transition-colors" title="Dark Mode">
                            <svg class="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path class="${isDark ? 'hidden' : ''}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
                                <path class="${isDark ? '' : 'hidden'}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
                            </svg>
                        </button>
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
        style.textContent = '.auth-tab.active { background: white; color: #1d4ed8; box-shadow: 0 1px 2px rgba(0,0,0,0.1); } .dark .auth-tab.active { background: #374151; color: #60a5fa; }';
        document.head.appendChild(style);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errEl.classList.add('hidden');
            const email = document.getElementById('auth-screen-email').value;
            const password = document.getElementById('auth-screen-password').value;
            try {
                if (mode === 'login') {
                    await Auth.login(email, password);
                } else {
                    const name = document.getElementById('auth-screen-name')?.value || '';
                    await Auth.register(email, password, name);
                }
                await this._initAuthenticated();
                Toast.show(mode === 'login' ? 'Willkommen zurück!' : 'Erfolgreich registriert!', { type: 'success', duration: 2000 });
            } catch (err) {
                errEl.textContent = err.message;
                errEl.classList.remove('hidden');
            }
        });

        document.getElementById('auth-dark-toggle')?.addEventListener('click', () => {
            DarkMode.toggle();
            this.render();
        });

        document.getElementById('auth-screen-email')?.focus();
    },

    _renderLoadingPlaceholder() {
        return `
            <div class="space-y-4 animate-pulse">
                <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
                <div class="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
        `;
    },

    renderPullToRefresh() {
        return `
            <div class="pull-to-refresh bg-blue-500 dark:bg-blue-600 text-white">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
            </div>
        `;
    },

    getFavoriteRecipes() {
        return AppState.recipes.filter(recipe => recipe.is_favorite);
    },

    renderFavoritesQuickAccess(favorites) {
        if (!favorites || favorites.length === 0) {
            return '';
        }

        const limitedFavorites = favorites.slice(0, 8);
        const overflow = favorites.length - limitedFavorites.length;

        return `
            <section class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-3 sm:p-4 transition-colors duration-200">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 text-red-500 dark:text-red-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                        </svg>
                        <h3 class="text-base font-semibold text-gray-800 dark:text-white">Favoriten Schnellzugriff</h3>
                    </div>
                </div>
                <div class="flex gap-3 overflow-x-auto favorite-quick-scroll pb-1">
                    ${limitedFavorites.map(recipe => `
                        <button type="button" class="favorite-quick-item flex-shrink-0 min-w-[160px] px-4 py-3 rounded-lg border border-red-100 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-left transition-colors hover:bg-red-100 dark:hover:bg-red-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 dark:focus-visible:ring-red-500" data-recipe-id="${recipe.id}" aria-label="${escapeHtml(recipe.name)} anzeigen">
                            <div class="flex items-center justify-between gap-3">
                                <span class="font-medium text-red-700 dark:text-red-200 truncate">${escapeHtml(recipe.name)}</span>
                                <svg class="w-4 h-4 text-red-400 dark:text-red-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L13.586 11H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                            <p class="mt-1 text-xs text-red-600 dark:text-red-300 truncate">${escapeHtml(recipe.category || 'Ohne Kategorie')}</p>
                        </button>
                    `).join('')}
                    ${overflow > 0 ? `
                        <div class="flex-shrink-0 min-w-[140px] px-4 py-3 rounded-lg border border-dashed border-red-200 dark:border-red-700 text-red-500 dark:text-red-300 flex items-center justify-center text-sm">
                            +${overflow} weitere
                        </div>
                    ` : ''}
                </div>
            </section>
        `;
    },

    _renderAuthButton() {
        const user = Auth.getUser();
        if (user) {
            const initial = (user.name || user.email).charAt(0).toUpperCase();
            return `<div id="header-auth-btn" class="relative">
                <button id="user-menu-btn" class="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center hover:bg-blue-700 transition-colors" title="${escapeHtml(user.email)}" aria-label="Benutzermenü">${initial}</button>
                <div id="user-dropdown" class="hidden absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
                    <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                        <p class="text-xs font-medium text-gray-900 dark:text-white truncate">${escapeHtml(user.name || '')}${user.role === 'admin' ? ' <span class="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">Admin</span>' : ''}</p>
                        <p class="text-[11px] text-gray-400 dark:text-gray-500 truncate">${escapeHtml(user.email)}</p>
                    </div>
                    <button id="user-logout-btn" class="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Abmelden</button>
                </div>
            </div>`;
        }
        return '';
    },

    _bindAuthButton() {
        const loginBtn = document.getElementById('header-auth-btn');
        if (loginBtn && !Auth.isAuthenticated()) {
            loginBtn.addEventListener('click', () => AuthModal.show('login', () => App.render()));
        }
        const menuBtn = document.getElementById('user-menu-btn');
        const dropdown = document.getElementById('user-dropdown');
        if (menuBtn && dropdown) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
            });
            document.addEventListener('click', () => dropdown.classList.add('hidden'), { once: true });
        }
        document.getElementById('user-logout-btn')?.addEventListener('click', async () => {
            await Auth.logout();
            // Reset app state
            AppState.recipes = [];
            AppState.weekPlan = null;
            AppState.weekPlansCache = {};
            AppState.pantryItems = [];
            this._viewCache = {};
            App.render();
            Toast.show('Abgemeldet', { type: 'default', duration: 2000 });
        });
    },

    renderHeader() {
        const isDark = document.documentElement.classList.contains('dark');
        const sunIconClass = isDark ? 'hidden' : '';
        const moonIconClass = isDark ? '' : 'hidden';

        return `
            <header class="bg-white dark:bg-gray-800 shadow-md transition-colors duration-200 sticky top-0 z-30" role="banner">
                <div class="container mx-auto px-4 py-3 sm:py-4">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-3">
                            <!-- Mobile menu button -->
                            <button id="mobile-menu-toggle" class="sm:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" aria-label="Menü öffnen">
                                <svg class="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                                </svg>
                            </button>
                            <div>
                                <h1 class="text-xl sm:text-3xl font-bold text-gray-800 dark:text-white">Food Planner</h1>
                                <p class="text-xs sm:text-base text-gray-600 dark:text-gray-300 hidden sm:block">Dein persönlicher Essenswochenplaner</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <button id="restart-tour-btn" class="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" title="Tour neu starten" aria-label="Einführungstour neu starten">
                                <svg class="w-6 h-6 text-gray-800 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                            </button>
                            <button id="dark-mode-toggle" class="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" title="Dark Mode umschalten">
                                <svg class="w-6 h-6 text-gray-800 dark:text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path class="${sunIconClass}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
                                    <path class="${moonIconClass}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
                                </svg>
                            </button>
                            ${this._renderAuthButton()}
                        </div>
                    </div>
                </div>
            </header>
        `;
    },

    renderMobileNavigation() {
        const tabs = [
            { id: 'planner', label: 'Wochenplan', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
            { id: 'meal-prep', label: 'Meal-Prep', icon: 'M5 13l4 4L19 7m-7-4a9 9 0 110 18 9 9 0 010-18z' },
            { id: 'recipes', label: 'Rezepte', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
            { id: 'ai-recipes', label: 'KI Rezepte', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
            { id: 'parser', label: 'Rezept Parser', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
            { id: 'shopping', label: 'Einkaufsliste', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
            { id: 'pantry', label: 'Speisekammer', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
            { id: 'history', label: 'Kochverlauf', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' }
        ];

        if (Auth.getUser()?.role === 'admin') {
            tabs.push({ id: 'admin', label: 'Benutzerverwaltung', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' });
        }

        return `
            <!-- Mobile navigation overlay -->
            <div class="mobile-nav-overlay" id="mobile-nav-overlay"></div>

            <!-- Mobile navigation menu -->
            <nav class="mobile-nav-menu bg-white dark:bg-gray-800">
                <div class="p-4 border-b dark:border-gray-700">
                    <div class="flex justify-between items-center">
                        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">Menü</h2>
                        <button id="close-mobile-menu" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <svg class="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="py-2">
                    ${tabs.map(tab => `
                        <button class="mobile-nav-btn w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            AppState.currentView === tab.id
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-l-4 border-blue-600 dark:border-blue-400'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }" data-view="${tab.id}">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${tab.icon}"></path>
                            </svg>
                            ${tab.label}
                        </button>
                    `).join('')}
                </div>
            </nav>
        `;
    },

    renderNavigation() {
        const tabs = [
            { id: 'planner', label: 'Wochenplan', shortLabel: 'Plan' },
            { id: 'meal-prep', label: 'Meal-Prep', shortLabel: 'Prep' },
            { id: 'recipes', label: 'Rezepte', shortLabel: 'Rezepte' },
            { id: 'ai-recipes', label: 'KI Rezepte', shortLabel: 'KI' },
            { id: 'parser', label: 'Rezept Parser', shortLabel: 'Parser' },
            { id: 'shopping', label: 'Einkaufsliste', shortLabel: 'Einkauf' },
            { id: 'pantry', label: 'Speisekammer', shortLabel: 'Vorrat' },
            { id: 'history', label: 'Kochverlauf', shortLabel: 'Verlauf' }
        ];

        if (Auth.getUser()?.role === 'admin') {
            tabs.push({ id: 'admin', label: 'Benutzer', shortLabel: 'Admin' });
        }

        // Desktop navigation (hidden on mobile)
        return `
            <nav class="hidden sm:block bg-white dark:bg-gray-800 border-b dark:border-gray-700 transition-colors duration-200 overflow-x-auto" role="navigation" aria-label="Hauptnavigation">
                <div class="container mx-auto px-4">
                    <div class="flex space-x-1 min-w-max" role="tablist" aria-label="Ansichten">
                        ${tabs.map((tab, index) => `
                            <button
                                class="nav-btn px-3 md:px-6 py-3 font-medium transition-colors whitespace-nowrap text-sm md:text-base ${
                                    AppState.currentView === tab.id
                                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                                        : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                                }"
                                data-view="${tab.id}"
                                data-nav="${tab.id}"
                                role="tab"
                                aria-selected="${AppState.currentView === tab.id}"
                                aria-controls="main-content"
                                tabindex="${AppState.currentView === tab.id ? '0' : '-1'}"
                                title="Taste ${index + 1} für Schnellzugriff"
                            >
                                <span class="hidden md:inline">${tab.label}</span>
                                <span class="md:hidden">${tab.shortLabel}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </nav>
        `;
    },

    attachEventListeners() {
        // Auth button
        this._bindAuthButton();

        // Dark mode toggle
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', () => {
                DarkMode.toggle();
                App.render();
            });
        }

        // Restart onboarding tour
        const restartTourBtn = document.getElementById('restart-tour-btn');
        if (restartTourBtn) {
            restartTourBtn.addEventListener('click', () => {
                OnboardingManager.restart();
            });
        }

        // Mobile menu toggle
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', () => this.toggleMobileMenu());
        }

        // Close mobile menu button
        const closeMobileMenu = document.getElementById('close-mobile-menu');
        if (closeMobileMenu) {
            closeMobileMenu.addEventListener('click', () => this.closeMobileMenu());
        }

        // Mobile nav overlay click to close
        const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
        if (mobileNavOverlay) {
            mobileNavOverlay.addEventListener('click', () => this.closeMobileMenu());
        }

        // Mobile navigation buttons
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.closeMobileMenu();
                AppState.setView(view);
            });
        });

        // Desktop navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                AppState.setView(view);
            });
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
