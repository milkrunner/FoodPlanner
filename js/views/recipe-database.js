import { AppState } from '../core/app-state.js';
import { StorageService } from '../core/storage-service.js';
import { Toast } from '../core/toast.js';
import { ActionHistory } from '../core/action-history.js';
import { escapeHtml, trapFocus } from '../core/utils.js';
import { App } from '../app.js';
import { API_BASE_URL } from '../config.js';

export const RecipeDatabaseView = {
    editingRecipe: null,
    viewingRecipe: null, // For detail view (read-only)
    _releaseFocusTrap: null,
    ingredients: [{ name: '', amount: '', unit: '', category: 'Sonstiges' }],
    tags: [],
    searchQuery: '',
    showFavoritesOnly: false,
    showSeasonalOnly: false, // Filter for seasonal recipes
    showMealPrepOnly: false, // Filter for meal-prep suitable recipes
    maxTimeFilter: null, // Filter for max total time (prep + cook)
    difficultyFilter: null, // Filter for difficulty level
    seasonalData: null, // Cache for seasonal recipe data
    currentSeasonInfo: null, // Current season info
    selectedTags: [],
    categories: ['Obst & Gemüse', 'Milchprodukte', 'Fleisch & Fisch', 'Trockenwaren', 'Tiefkühl', 'Sonstiges'],
    availableTags: ['vegetarisch', 'vegan', 'glutenfrei', 'laktosefrei', 'schnell', 'günstig', 'meal-prep', 'Frühling', 'Sommer', 'Herbst', 'Winter'],
    scalingRecipe: null,
    scaledIngredients: null,
    newServings: null,
    isScaling: false,
    // AI Search state
    aiSearchActive: false,
    aiSearchResults: null,
    aiSearchInfo: null,
    isAiSearching: false,

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
                        <button type="button" class="favorite-quick-item flex-shrink-0 min-w-[160px] px-4 py-3 rounded-lg border border-red-100 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-left transition-colors hover:bg-red-100 dark:hover:bg-red-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 dark:focus-visible:ring-red-500" data-recipe-id="${recipe.id}" aria-label="${recipe.name} anzeigen">
                            <div class="flex items-center justify-between gap-3">
                                <span class="font-medium text-red-700 dark:text-red-200 truncate">${recipe.name}</span>
                                <svg class="w-4 h-4 text-red-400 dark:text-red-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L13.586 11H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                            <p class="mt-1 text-xs text-red-600 dark:text-red-300 truncate">${recipe.category || 'Ohne Kategorie'}</p>
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

    categoryCache: new Map(), // Local cache for ingredient categories
    cookingStats: null, // Cache for cooking statistics
    // AI Analysis & Variants
    analysisData: null, // Current analysis results
    isAnalyzing: false,
    variantData: null, // Current variant results
    isGeneratingVariant: false,
    showAnalysisModal: false,
    showVariantModal: false,
    variantTypes: null, // Cached variant types

    getFavoriteRecipes() {
        return AppState.recipes.filter(recipe => recipe.is_favorite);
    },

    async loadSeasonalData() {
        if (!this.seasonalData) {
            this.seasonalData = await StorageService.getSeasonalRecipes();
        }
        if (!this.currentSeasonInfo) {
            this.currentSeasonInfo = await StorageService.getSeasonInfo();
        }
        return this.seasonalData;
    },

    getSeasonalRecipeIds() {
        if (!this.seasonalData || !this.seasonalData.recipes) return new Set();
        return new Set(this.seasonalData.recipes.map(r => r.id));
    },

    getSeasonalScoreForRecipe(recipeId) {
        if (!this.seasonalData || !this.seasonalData.recipes) return 0;
        const recipe = this.seasonalData.recipes.find(r => r.id === recipeId);
        return recipe ? recipe.seasonalScore : 0;
    },

    getCurrentSeasonName() {
        return this.currentSeasonInfo?.current?.name || 'Saison';
    },

    getSeasonIcon(seasonKey) {
        const icons = {
            spring: '🌸',
            summer: '☀️',
            autumn: '🍂',
            winter: '❄️'
        };
        return icons[seasonKey] || '🌿';
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
                        <button type="button" class="favorite-quick-item flex-shrink-0 min-w-[160px] px-4 py-3 rounded-lg border border-red-100 dark:border-red-700 bg-red-50 dark:bg-red-900/20 text-left transition-colors hover:bg-red-100 dark:hover:bg-red-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 dark:focus-visible:ring-red-500" data-recipe-id="${recipe.id}" aria-label="${recipe.name} anzeigen">
                            <div class="flex items-center justify-between gap-3">
                                <span class="font-medium text-red-700 dark:text-red-200 truncate">${recipe.name}</span>
                                <svg class="w-4 h-4 text-red-400 dark:text-red-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd" d="M10.293 15.707a1 1 0 010-1.414L13.586 11H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                            <p class="mt-1 text-xs text-red-600 dark:text-red-300 truncate">${recipe.category || 'Ohne Kategorie'}</p>
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

    async loadCookingStats() {
        if (!this.cookingStats) {
            this.cookingStats = await StorageService.getCookingStats();
        }
        return this.cookingStats;
    },

    getCookingStatsForRecipe(recipeId) {
        if (!this.cookingStats) return null;
        return this.cookingStats.find(stat => stat.recipe_id === recipeId);
    },

    formatLastCooked(dateString) {
        if (!dateString) return null;
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Heute';
        if (diffDays === 1) return 'Gestern';
        if (diffDays < 7) return `Vor ${diffDays} Tagen`;
        if (diffDays < 30) return `Vor ${Math.floor(diffDays / 7)} Woche(n)`;
        if (diffDays < 365) return `Vor ${Math.floor(diffDays / 30)} Monat(en)`;
        return `Vor ${Math.floor(diffDays / 365)} Jahr(en)`;
    },

    render() {
        // Load cooking stats if not loaded
        if (!this.cookingStats) {
            this.loadCookingStats().then(() => App.render());
        }
        // Load seasonal data if not loaded
        if (!this.seasonalData) {
            this.loadSeasonalData().then(() => App.render());
        }
        const favoriteRecipes = this.getFavoriteRecipes();
        const favoriteCount = favoriteRecipes.length;
        const filteredRecipes = this.filterRecipes();
        const seasonalRecipeIds = this.getSeasonalRecipeIds();
        const seasonalCount = seasonalRecipeIds.size;
        const mealPrepCount = AppState.recipes.filter(r => r.is_meal_prep_suitable).length;
        const seasonName = this.getCurrentSeasonName();
        const seasonKey = this.currentSeasonInfo?.current?.key || 'winter';
        const seasonIcon = this.getSeasonIcon(seasonKey);

        return `
            <div class="space-y-4 sm:space-y-6">
                <!-- Header - stacks on mobile -->
                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <h2 class="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Rezeptdatenbank</h2>
                    <button id="new-recipe-btn" class="w-full sm:w-auto px-4 py-3 sm:py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 active:scale-98">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                        Neues Rezept
                    </button>
                </div>

                ${this.renderFavoritesQuickAccess(favoriteRecipes)}

                ${AppState.recipes.length > 0 ? `
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-3 sm:p-4 transition-colors duration-200">
                        <div class="flex gap-2">
                            <div class="relative flex-1">
                                <input
                                    type="text"
                                    id="recipe-search-input"
                                    value="${this.searchQuery}"
                                    placeholder="${this.aiSearchActive ? 'z.B. \"Etwas Leichtes für heute Abend\" oder \"Was kann ich mit Tomaten machen?\"' : 'Rezepte durchsuchen...'}"
                                    class="w-full px-4 py-3 sm:py-2 pl-10 ${this.searchQuery && !this.aiSearchActive ? 'pr-10' : ''} border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-base"
                                    aria-label="Rezepte durchsuchen"
                                />
                                <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                </svg>
                                ${this.searchQuery && !this.aiSearchActive ? `
                                    <button id="clear-search-btn" class="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                        </svg>
                                    </button>
                                ` : ''}
                            </div>
                            <button
                                id="ai-search-toggle-btn"
                                class="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${this.aiSearchActive ? 'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300' : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-200 dark:hover:border-purple-800'}"
                                title="${this.aiSearchActive ? 'KI-Suche deaktivieren' : 'KI-Suche aktivieren - Suche mit natürlicher Sprache'}"
                            >
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                                </svg>
                                <span class="hidden sm:inline">KI</span>
                            </button>
                            ${this.aiSearchActive ? `
                                <button
                                    id="ai-search-btn"
                                    class="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    ${!this.searchQuery.trim() || this.isAiSearching ? 'disabled' : ''}
                                >
                                    ${this.isAiSearching ? `
                                        <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ` : `
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                        </svg>
                                    `}
                                    <span class="hidden sm:inline">${this.isAiSearching ? 'Suche...' : 'Suchen'}</span>
                                </button>
                            ` : ''}
                        </div>
                        ${this.aiSearchActive && this.aiSearchInfo ? `
                            <div class="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                <div class="flex items-start gap-2">
                                    <svg class="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                                    </svg>
                                    <div class="flex-1 min-w-0">
                                        <p class="text-sm text-purple-800 dark:text-purple-200">
                                            ${this.aiSearchInfo.interpretation || 'KI-Suche aktiv'}
                                        </p>
                                        <p class="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                            ${this.aiSearchInfo.matchCount} Ergebnis${this.aiSearchInfo.matchCount !== 1 ? 'se' : ''} gefunden
                                            ${this.aiSearchInfo.aiPowered ? '' : ' (Klassische Suche)'}
                                            ${this.aiSearchInfo.duration ? ` in ${(this.aiSearchInfo.duration / 1000).toFixed(1)}s` : ''}
                                        </p>
                                    </div>
                                    <button id="clear-ai-search-btn" class="p-1 text-purple-400 hover:text-purple-600 dark:text-purple-500 dark:hover:text-purple-300">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ` : ''}
                        <div class="flex flex-wrap items-center gap-2 mt-3 text-sm">
                            ${favoriteCount > 0 ? `
                                <button id="favorites-filter-btn" class="favorites-filter-btn flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${this.showFavoritesOnly ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-300' : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}" aria-pressed="${this.showFavoritesOnly}">
                                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                                    </svg>
                                    <span class="hidden sm:inline">${this.showFavoritesOnly ? 'Alle' : 'Favoriten'}</span>
                                    <span class="sm:hidden">${favoriteCount}</span>
                                </button>
                            ` : ''}
                            ${seasonalCount > 0 ? `
                                <button id="seasonal-filter-btn" class="seasonal-filter-btn flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${this.showSeasonalOnly ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-600 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}" aria-pressed="${this.showSeasonalOnly}" title="Rezepte mit saisonalen Zutaten (${seasonName})">
                                    <span class="text-base">${seasonIcon}</span>
                                    <span class="hidden sm:inline">${this.showSeasonalOnly ? 'Alle' : seasonName}</span>
                                    <span class="sm:hidden">${seasonalCount}</span>
                                </button>
                            ` : ''}
                            ${mealPrepCount > 0 ? `
                                <button id="meal-prep-filter-btn" class="meal-prep-filter-btn flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${this.showMealPrepOnly ? 'bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-300' : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}" aria-pressed="${this.showMealPrepOnly}" title="Meal-Prep geeignete Rezepte">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                    <span class="hidden sm:inline">${this.showMealPrepOnly ? 'Alle' : 'Meal-Prep'}</span>
                                    <span class="sm:hidden">${mealPrepCount}</span>
                                </button>
                            ` : ''}
                            <div class="relative">
                                <select id="time-filter" class="px-3 py-2 rounded-lg border bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Nach Zeit filtern">
                                    <option value="">Zeit</option>
                                    <option value="15" ${this.maxTimeFilter === 15 ? 'selected' : ''}>Unter 15 Min.</option>
                                    <option value="30" ${this.maxTimeFilter === 30 ? 'selected' : ''}>Unter 30 Min.</option>
                                    <option value="60" ${this.maxTimeFilter === 60 ? 'selected' : ''}>Unter 1 Stunde</option>
                                </select>
                            </div>
                            <div class="relative">
                                <select id="difficulty-filter" class="px-3 py-2 rounded-lg border bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Nach Schwierigkeit filtern">
                                    <option value="">Schwierigkeit</option>
                                    <option value="Einfach" ${this.difficultyFilter === 'Einfach' ? 'selected' : ''}>Einfach</option>
                                    <option value="Mittel" ${this.difficultyFilter === 'Mittel' ? 'selected' : ''}>Mittel</option>
                                    <option value="Fortgeschritten" ${this.difficultyFilter === 'Fortgeschritten' ? 'selected' : ''}>Fortgeschritten</option>
                                </select>
                            </div>
                            <span class="ml-auto text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
                                ${filteredRecipes.length} von ${AppState.recipes.length} Rezepte
                            </span>
                        </div>
                        ${this.searchQuery ? `
                            <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                                ${filteredRecipes.length} von ${AppState.recipes.length} Rezept${filteredRecipes.length !== 1 ? 'en' : ''} gefunden
                            </p>
                        ` : ''}
                    </div>
                ` : ''}

                ${AppState.recipes.length === 0 ? `
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-8 text-center transition-colors duration-200">
                        <svg class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                        </svg>
                        <p class="text-gray-500 dark:text-gray-400">Noch keine Rezepte vorhanden.</p>
                        <p class="text-gray-400 dark:text-gray-500 text-sm mt-2">Erstelle dein erstes Rezept!</p>
                    </div>
                ` : filteredRecipes.length === 0 ? `
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-8 text-center transition-colors duration-200">
                        <p class="text-gray-500 dark:text-gray-400">Keine Rezepte gefunden.</p>
                        <p class="text-gray-400 dark:text-gray-500 text-sm mt-2">Versuche einen anderen Suchbegriff.</p>
                    </div>
                ` : `
                    <!-- Responsive grid: 1 col on mobile, 2 on tablet, 3 on desktop -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        ${filteredRecipes.map(recipe => {
                            const cookingStat = this.getCookingStatsForRecipe(recipe.id);
                            const lastCookedText = cookingStat ? this.formatLastCooked(cookingStat.last_cooked_at) : null;
                            return `
                            <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-4 hover:shadow-lg dark:hover:shadow-gray-900 transition-all duration-200 active:scale-[0.99] cursor-pointer recipe-card" data-recipe-card-id="${recipe.id}">
                                <div class="flex items-start justify-between gap-3 mb-2">
                                    <h3 class="text-base sm:text-lg font-semibold text-gray-800 dark:text-white line-clamp-2 flex-1">${recipe.name}</h3>
                                    <button type="button" class="favorite-toggle-btn ${recipe.is_favorite ? 'is-favorite' : ''} p-2 rounded-full transition transform favorite-heart" data-recipe-id="${recipe.id}" title="${recipe.is_favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}" aria-label="${recipe.is_favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}">
                                        <svg class="w-5 h-5 favorite-heart-icon" viewBox="0 0 24 24" fill="${recipe.is_favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8">
                                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                                        </svg>
                                    </button>
                                </div>
                                <div class="flex flex-wrap gap-1 mb-2">
                                    ${recipe.category ? `
                                        <span class="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs rounded">
                                            ${recipe.category}
                                        </span>
                                    ` : ''}
                                    ${recipe.is_meal_prep_suitable ? `
                                        <span class="inline-block px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-xs rounded" title="Meal-Prep geeignet">
                                            Meal-Prep
                                        </span>
                                    ` : ''}
                                    ${lastCookedText ? `
                                        <span class="inline-block px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 text-xs rounded" title="Zuletzt gekocht">
                                            ${lastCookedText}
                                        </span>
                                    ` : ''}
                                    ${cookingStat && cookingStat.times_cooked > 0 ? `
                                        <span class="inline-block px-2 py-1 bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 text-xs rounded" title="Anzahl gekocht">
                                            ${cookingStat.times_cooked}x
                                        </span>
                                    ` : ''}
                                </div>
                                ${recipe.tags && recipe.tags.length > 0 ? `
                                    <div class="flex flex-wrap gap-1 mb-2">
                                        ${recipe.tags.slice(0, 3).map(tag => `
                                            <span class="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-xs rounded-full">
                                                ${tag}
                                            </span>
                                        `).join('')}
                                        ${recipe.tags.length > 3 ? `<span class="text-xs text-gray-400">+${recipe.tags.length - 3}</span>` : ''}
                                    </div>
                                ` : ''}
                                ${recipe._searchReason ? `
                                    <div class="flex items-center gap-2 mb-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                                        <svg class="w-4 h-4 text-purple-500 dark:text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                                        </svg>
                                        <span class="text-xs text-purple-700 dark:text-purple-300">${recipe._searchReason}</span>
                                        ${recipe._searchScore ? `<span class="ml-auto text-xs font-medium text-purple-600 dark:text-purple-400">${recipe._searchScore}%</span>` : ''}
                                    </div>
                                ` : ''}
                                <div class="flex items-center flex-wrap gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    ${recipe.prep_time || recipe.cook_time ? `
                                        <span class="inline-flex items-center gap-1">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                            </svg>
                                            ${(recipe.prep_time || 0) + (recipe.cook_time || 0)} Min.
                                        </span>
                                        <span>•</span>
                                    ` : ''}
                                    ${recipe.difficulty ? `
                                        <span class="inline-flex items-center gap-1">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                                            </svg>
                                            ${recipe.difficulty}
                                        </span>
                                        <span>•</span>
                                    ` : ''}
                                    ${recipe.servings ? `<span>${recipe.servings} Portionen</span><span>•</span>` : ''}
                                    <span>${recipe.ingredients.length} Zutat${recipe.ingredients.length !== 1 ? 'en' : ''}</span>
                                </div>
                                <div class="flex flex-col gap-2">
                                    ${recipe.servings && recipe.ingredients.length > 0 ? `
                                        <button class="scale-portions-btn w-full px-3 py-2.5 sm:py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors text-sm font-medium active:scale-98"
                                                data-recipe-id="${recipe.id}">
                                            Portionen anpassen
                                        </button>
                                    ` : ''}
                                    <div class="grid grid-cols-2 gap-2">
                                        <button class="edit-recipe-btn px-3 py-2.5 sm:py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium active:scale-98"
                                                data-recipe-id="${recipe.id}">
                                            Bearbeiten
                                        </button>
                                        <button class="delete-recipe-btn px-3 py-2.5 sm:py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm font-medium active:scale-98"
                                                data-recipe-id="${recipe.id}">
                                            Löschen
                                        </button>
                                    </div>
                                    <button class="duplicate-recipe-btn w-full px-3 py-2.5 sm:py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium active:scale-98"
                                            data-recipe-id="${recipe.id}">
                                        Duplizieren
                                    </button>
                                </div>
                            </div>
                        `;}).join('')}
                    </div>
                `}

                ${this.renderRecipeDetail()}
                ${this.renderRecipeForm()}
                ${this.renderPortionScalingModal()}
                ${this.renderAnalysisModal()}
                ${this.renderVariantModal()}
            </div>
        `;
    },

    renderRecipeDetail() {
        if (!this.viewingRecipe) return '';

        const recipe = this.viewingRecipe;
        const cookingStat = this.getCookingStatsForRecipe(recipe.id);
        const lastCookedText = cookingStat ? this.formatLastCooked(cookingStat.last_cooked_at) : null;

        // Parse markdown for instructions
        const renderMarkdown = (text) => {
            if (!text) return '<p class="text-gray-500 dark:text-gray-400 italic">Keine Anleitung vorhanden</p>';

            const preprocessInstructions = (raw) => {
                // First, split inline "Schritt X:" patterns onto new lines
                let processed = raw.replace(/([.!?])\s*(Schritt\s*\d+\s*[:.])/gi, '$1\n\n$2');

                const lines = processed.split('\n');
                const processedLines = [];

                lines.forEach((line) => {
                    const trimmed = line.trim();
                    if (!trimmed) {
                        processedLines.push('');
                        return;
                    }

                    // Match "Schritt X:" or "Schritt X." at the beginning of a line
                    const stepMatch = trimmed.match(/^schritt\s*(\d+)\s*[:.\-]\s*(.*)$/i);

                    if (stepMatch) {
                        const stepNumber = stepMatch[1];
                        const remainder = stepMatch[2] ? stepMatch[2].trim() : '';

                        // Add blank line before heading if needed
                        if (processedLines.length > 0 && processedLines[processedLines.length - 1] !== '') {
                            processedLines.push('');
                        }
                        processedLines.push(`### Schritt ${stepNumber}`);
                        processedLines.push('');

                        if (remainder.length > 0) {
                            processedLines.push(remainder);
                        }
                    } else {
                        processedLines.push(trimmed);
                    }
                });

                return processedLines.join('\n');
            };

            const enhancedText = preprocessInstructions(text);

            if (typeof window.marked !== 'undefined') {
                // Configure marked for safety
                window.marked.setOptions({
                    breaks: true,
                    gfm: true
                });
                return window.marked.parse(enhancedText);
            }

            // Fallback: simple line breaks
            return enhancedText.split('\n').map(line => `<p>${line}</p>`).join('');
        };

        // Group ingredients by category
        const ingredientsByCategory = {};
        (recipe.ingredients || []).forEach(ing => {
            const cat = ing.category || 'Sonstiges';
            if (!ingredientsByCategory[cat]) ingredientsByCategory[cat] = [];
            ingredientsByCategory[cat].push(ing);
        });

        return `
            <div id="recipe-detail-modal" class="modal active" data-backdrop="true" role="dialog" aria-modal="true" aria-labelledby="recipe-detail-title">
                <div id="recipe-detail-content" class="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
                    <!-- Header -->
                    <div class="p-4 sm:p-6 border-b dark:border-gray-700 bg-gradient-to-r from-blue-500 to-purple-600 flex-shrink-0">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <h2 id="recipe-detail-title" class="text-xl sm:text-2xl font-bold text-white mb-2">${recipe.name}</h2>
                                <div class="flex flex-wrap gap-2">
                                    ${recipe.category ? `
                                        <span class="px-3 py-1 bg-white/20 text-white text-sm rounded-full">
                                            ${recipe.category}
                                        </span>
                                    ` : ''}
                                    ${recipe.servings ? `
                                        <span class="px-3 py-1 bg-white/20 text-white text-sm rounded-full">
                                            ${recipe.servings} Portionen
                                        </span>
                                    ` : ''}
                                    ${recipe.prep_time || recipe.cook_time ? `
                                        <span class="px-3 py-1 bg-white/20 text-white text-sm rounded-full inline-flex items-center gap-1">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                            </svg>
                                            ${recipe.prep_time ? `${recipe.prep_time} Min. Vorbereitung` : ''}${recipe.prep_time && recipe.cook_time ? ' + ' : ''}${recipe.cook_time ? `${recipe.cook_time} Min. Kochen` : ''}
                                        </span>
                                    ` : ''}
                                    ${recipe.difficulty ? `
                                        <span class="px-3 py-1 bg-white/20 text-white text-sm rounded-full inline-flex items-center gap-1">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                                            </svg>
                                            ${recipe.difficulty}
                                        </span>
                                    ` : ''}
                                    ${lastCookedText ? `
                                        <span class="px-3 py-1 bg-white/20 text-white text-sm rounded-full">
                                            Zuletzt: ${lastCookedText}
                                        </span>
                                    ` : ''}
                                    ${cookingStat && cookingStat.times_cooked > 0 ? `
                                        <span class="px-3 py-1 bg-white/20 text-white text-sm rounded-full">
                                            ${cookingStat.times_cooked}x gekocht
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
                            <button id="close-recipe-detail" class="text-white/80 hover:text-white text-2xl p-1">
                                ✕
                            </button>
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="p-4 sm:p-6 flex-1">
                        <!-- Tags -->
                        ${recipe.tags && recipe.tags.length > 0 ? `
                            <div class="flex flex-wrap gap-2 mb-6">
                                ${recipe.tags.map(tag => `
                                    <span class="px-3 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-sm rounded-full">
                                        ${tag}
                                    </span>
                                `).join('')}
                            </div>
                        ` : ''}

                        <!-- Meal-Prep Info -->
                        ${recipe.is_meal_prep_suitable ? `
                            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
                                <div class="flex items-center gap-2 mb-3">
                                    <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                    <h4 class="font-semibold text-green-800 dark:text-green-200">Meal-Prep geeignet</h4>
                                </div>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    ${recipe.meal_prep_fridge_days ? `
                                        <div class="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                            <span class="text-lg">🧊</span>
                                            <span><strong>${recipe.meal_prep_fridge_days} Tage</strong> im Kühlschrank</span>
                                        </div>
                                    ` : ''}
                                    ${recipe.meal_prep_freezer_days ? `
                                        <div class="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                            <span class="text-lg">❄️</span>
                                            <span><strong>${recipe.meal_prep_freezer_days} Tage</strong> im Gefrierschrank</span>
                                        </div>
                                    ` : ''}
                                </div>
                                ${recipe.meal_prep_reheat_tips ? `
                                    <div class="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                                        <p class="text-sm text-gray-700 dark:text-gray-300">
                                            <strong class="text-green-800 dark:text-green-200">Aufwärm-Tipps:</strong> ${recipe.meal_prep_reheat_tips}
                                        </p>
                                    </div>
                                ` : ''}
                                ${recipe.meal_prep_batch_notes ? `
                                    <div class="mt-3 ${recipe.meal_prep_reheat_tips ? '' : 'pt-3 border-t border-green-200 dark:border-green-700'}">
                                        <p class="text-sm text-gray-700 dark:text-gray-300">
                                            <strong class="text-green-800 dark:text-green-200">Batch-Cooking Tipps:</strong> ${recipe.meal_prep_batch_notes}
                                        </p>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}

                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <!-- Ingredients -->
                            <div>
                                <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                    <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                                    </svg>
                                    Zutaten
                                </h3>
                                ${recipe.ingredients && recipe.ingredients.length > 0 ? `
                                    <div class="space-y-4">
                                        ${Object.entries(ingredientsByCategory).map(([category, ingredients]) => `
                                            <div>
                                                <h4 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">${category}</h4>
                                                <ul class="space-y-2">
                                                    ${ingredients.map(ing => `
                                                        <li class="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                                                            <span class="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                                                            <span class="font-medium">${ing.amount || ''} ${ing.unit || ''}</span>
                                                            <span>${ing.name}</span>
                                                        </li>
                                                    `).join('')}
                                                </ul>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : `
                                    <p class="text-gray-500 dark:text-gray-400 italic">Keine Zutaten vorhanden</p>
                                `}
                            </div>

                            <!-- Instructions -->
                            <div>
                                <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                                    <svg class="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"></path>
                                    </svg>
                                    Zubereitung
                                </h3>
                                <div class="prose prose-sm dark:prose-invert max-w-none recipe-instructions">
                                    ${renderMarkdown(recipe.instructions)}
                                </div>
                            </div>
                        </div>

                        <!-- AI Assistant -->
                        <div class="mt-6">
                            <div class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 sm:p-5">
                                <div class="flex items-start gap-3">
                                    <span class="text-2xl">🤖</span>
                                    <div class="flex-1 space-y-3">
                                        <div>
                                            <h4 class="font-semibold text-gray-800 dark:text-white">KI-Assistent</h4>
                                            <p class="text-sm text-gray-600 dark:text-gray-400">Erhalte Verbesserungsvorschläge oder erstelle direkt eine Variante dieses Rezepts.</p>
                                        </div>
                                        <div class="flex flex-wrap gap-2">
                                            <button id="analyze-recipe-btn"
                                                    class="px-4 py-2 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                                                    data-recipe-id="${recipe.id}" ${this.isAnalyzing ? 'disabled' : ''}>
                                                ${this.isAnalyzing ? 'Analysiere...' : 'Analysieren'}
                                            </button>
                                            <button id="open-variant-modal-btn"
                                                    class="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                                                    data-recipe-id="${recipe.id}" ${this.isGeneratingVariant ? 'disabled' : ''}>
                                                ${this.isGeneratingVariant ? 'Erstelle...' : 'Variante erstellen'}
                                            </button>
                                        </div>
                                        ${!this.variantTypes ? '<p class="text-xs text-indigo-600 dark:text-indigo-300">Tipp: Wähle im nächsten Schritt zwischen vegetarisch, vegan, Low-Carb und weiteren Varianten.</p>' : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer Actions -->
                    <div class="p-4 sm:p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-wrap gap-3 flex-shrink-0">
                        <button id="edit-recipe-from-detail" class="flex-1 sm:flex-none px-4 py-2.5 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                data-recipe-id="${recipe.id}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                            Bearbeiten
                        </button>
                        <button id="mark-cooked-from-detail" class="flex-1 sm:flex-none px-4 py-2.5 bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                                data-recipe-id="${recipe.id}" data-recipe-name="${recipe.name}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Als gekocht markieren
                        </button>
                        <button id="favorite-from-detail" class="px-4 py-2.5 ${recipe.is_favorite ? 'bg-red-500 dark:bg-red-600' : 'bg-gray-200 dark:bg-gray-700'} ${recipe.is_favorite ? 'text-white' : 'text-gray-700 dark:text-gray-200'} rounded-lg hover:opacity-90 transition-colors flex items-center justify-center gap-2"
                                data-recipe-id="${recipe.id}">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="${recipe.is_favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                            </svg>
                            ${recipe.is_favorite ? 'Favorit' : 'Favorisieren'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    renderRecipeForm() {
        return `
            <div id="recipe-form-modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="recipe-form-title">
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
                    <div class="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                        <h3 id="recipe-form-title" class="text-xl font-semibold text-gray-800 dark:text-white">
                            ${this.editingRecipe ? 'Rezept bearbeiten' : 'Neues Rezept'}
                        </h3>
                        <button id="close-recipe-form" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl">
                            ✕
                        </button>
                    </div>
                    <form id="recipe-form" class="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rezeptname *</label>
                                <input type="text" id="recipe-name" required
                                       class="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                            </div>

                            <div class="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategorie</label>
                                    <input type="text" id="recipe-category" placeholder="z.B. Hauptgericht, Dessert"
                                           class="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Portionen</label>
                                    <input type="number" id="recipe-servings" min="1"
                                           class="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                                </div>
                            </div>

                            <div class="grid md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vorbereitungszeit (Min.)</label>
                                    <input type="number" id="recipe-prep-time" min="0" placeholder="z.B. 15"
                                           class="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kochzeit (Min.)</label>
                                    <input type="number" id="recipe-cook-time" min="0" placeholder="z.B. 30"
                                           class="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Schwierigkeit</label>
                                    <select id="recipe-difficulty"
                                            class="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                                        <option value="">-- Auswählen --</option>
                                        <option value="Einfach">Einfach</option>
                                        <option value="Mittel">Mittel</option>
                                        <option value="Fortgeschritten">Fortgeschritten</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Meal-Prep Section -->
                            <div class="border dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
                                <div class="flex items-center gap-3 mb-4">
                                    <label class="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" id="recipe-meal-prep-suitable"
                                               class="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-green-500 focus:ring-green-500 dark:focus:ring-green-400">
                                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Meal-Prep geeignet</span>
                                    </label>
                                </div>
                                <div id="meal-prep-fields" class="hidden space-y-4">
                                    <div class="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Haltbarkeit Kühlschrank (Tage)</label>
                                            <input type="number" id="recipe-fridge-days" min="0" max="14" placeholder="z.B. 3"
                                                   class="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                                        </div>
                                        <div>
                                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Haltbarkeit Gefrierschrank (Tage)</label>
                                            <input type="number" id="recipe-freezer-days" min="0" max="365" placeholder="z.B. 30"
                                                   class="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Aufwärm-Tipps</label>
                                        <textarea id="recipe-reheat-tips" rows="2" placeholder="z.B. In der Mikrowelle 2-3 Min. bei 600W"
                                                  class="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"></textarea>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Batch-Cooking Notizen</label>
                                        <textarea id="recipe-batch-notes" rows="2" placeholder="z.B. Sauce separat aufbewahren"
                                                  class="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"></textarea>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div class="flex justify-between items-center mb-2">
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Zutaten</label>
                                    <button type="button" id="add-ingredient-btn" class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                                        + Zutat hinzufügen
                                    </button>
                                </div>
                                <div id="ingredients-container"></div>
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
                                <div class="flex flex-wrap gap-2 mb-2" id="selected-tags-container">
                                    ${this.tags.map(tag => `
                                        <span class="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-full text-sm">
                                            ${tag}
                                            <button type="button" class="remove-tag-btn hover:text-blue-600 dark:hover:text-blue-200" data-tag="${tag}">✕</button>
                                        </span>
                                    `).join('')}
                                </div>
                                <div class="flex flex-wrap gap-2">
                                    ${this.availableTags.map(tag => `
                                        <button type="button" class="add-tag-btn px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors ${this.tags.includes(tag) ? 'opacity-50 cursor-not-allowed' : ''}"
                                                data-tag="${tag}" ${this.tags.includes(tag) ? 'disabled' : ''}>
                                            + ${tag}
                                        </button>
                                    `).join('')}
                                </div>
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Zubereitung
                                    <span class="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">(Markdown unterstützt)</span>
                                </label>
                                <textarea id="recipe-instructions" rows="8" placeholder="## Vorbereitung
1. Gemüse waschen und schneiden
2. Gewürze bereitstellen

## Zubereitung
1. Öl in der Pfanne erhitzen (*ca. 2 Min*)
2. Zwiebeln **glasig** dünsten
3. Restliches Gemüse hinzufügen

## Tipps
- Kann gut vorbereitet werden"
                                          class="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 font-mono text-sm"></textarea>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Nutze **fett**, *kursiv*, ## Überschriften und nummerierte Listen
                                </p>
                            </div>
                        </div>

                        <div class="flex gap-3 mt-6">
                            <button type="submit" class="flex-1 px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors">
                                ${this.editingRecipe ? 'Aktualisieren' : 'Erstellen'}
                            </button>
                            <button type="button" id="cancel-recipe-form" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                Abbrechen
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    attachEventListeners() {
        // Search input
        const searchInput = document.getElementById('recipe-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                // Only re-render for classic search (instant filtering)
                // For AI search, wait until user clicks search button
                if (!this.aiSearchActive) {
                    App.render();
                }
            });
        }

        // Clear search button
        const clearSearchBtn = document.getElementById('clear-search-btn');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                this.searchQuery = '';
                App.render();
            });
        }

        // AI Search toggle button
        const aiSearchToggleBtn = document.getElementById('ai-search-toggle-btn');
        if (aiSearchToggleBtn) {
            aiSearchToggleBtn.addEventListener('click', () => {
                this.aiSearchActive = !this.aiSearchActive;
                if (!this.aiSearchActive) {
                    this.aiSearchResults = null;
                    this.aiSearchInfo = null;
                }
                App.render();
            });
        }

        // AI Search button
        const aiSearchBtn = document.getElementById('ai-search-btn');
        if (aiSearchBtn) {
            aiSearchBtn.addEventListener('click', () => this.performAiSearch());
        }

        // Clear AI search results button
        const clearAiSearchBtn = document.getElementById('clear-ai-search-btn');
        if (clearAiSearchBtn) {
            clearAiSearchBtn.addEventListener('click', () => {
                this.aiSearchResults = null;
                this.aiSearchInfo = null;
                this.searchQuery = '';
                App.render();
            });
        }

        // Enter key triggers AI search when AI mode is active
        if (searchInput && this.aiSearchActive) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && this.searchQuery.trim()) {
                    e.preventDefault();
                    this.performAiSearch();
                }
            });
        }

        const favoritesFilterBtn = document.getElementById('favorites-filter-btn');
        if (favoritesFilterBtn) {
            favoritesFilterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showFavoritesOnly = !this.showFavoritesOnly;
                App.render();
            });
        }

        // Seasonal filter button
        const seasonalFilterBtn = document.getElementById('seasonal-filter-btn');
        if (seasonalFilterBtn) {
            seasonalFilterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSeasonalOnly = !this.showSeasonalOnly;
                App.render();
            });
        }

        // Meal-prep filter button
        const mealPrepFilterBtn = document.getElementById('meal-prep-filter-btn');
        if (mealPrepFilterBtn) {
            mealPrepFilterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showMealPrepOnly = !this.showMealPrepOnly;
                App.render();
            });
        }

        // Time filter
        const timeFilter = document.getElementById('time-filter');
        if (timeFilter) {
            timeFilter.addEventListener('change', (e) => {
                const value = e.target.value;
                this.maxTimeFilter = value ? parseInt(value) : null;
                App.render();
            });
        }

        // Difficulty filter
        const difficultyFilter = document.getElementById('difficulty-filter');
        if (difficultyFilter) {
            difficultyFilter.addEventListener('change', (e) => {
                this.difficultyFilter = e.target.value || null;
                App.render();
            });
        }

        // New recipe button
        const newBtn = document.getElementById('new-recipe-btn');
        if (newBtn) {
            newBtn.addEventListener('click', async () => await this.showRecipeForm());
        }

        // Recipe card click - open detail view
        document.querySelectorAll('.recipe-card').forEach(card => {
            card.addEventListener('click', async (e) => {
                // Don't trigger if clicking on a button inside the card
                if (e.target.closest('button')) return;
                // Don't trigger if a modal is already open
                if (e.target.closest('.modal')) return;
                // Don't trigger if recipe detail is already open
                if (this.viewingRecipe) return;
                const recipeId = card.dataset.recipeCardId;
                await this.viewRecipe(recipeId);
            });
        });

        // Edit recipe buttons (from card)
        document.querySelectorAll('.edit-recipe-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const recipeId = e.target.closest('button').dataset.recipeId;
                await this.editRecipe(recipeId);
            });
        });

        // Recipe detail modal event listeners
        const recipeDetailModal = document.getElementById('recipe-detail-modal');
        if (recipeDetailModal) {
            recipeDetailModal.addEventListener('click', (e) => {
                // Close when clicking on the backdrop (not on the content)
                if (e.target === recipeDetailModal) {
                    this.hideRecipeDetail();
                }
            });
        }

        const closeDetailBtn = document.getElementById('close-recipe-detail');
        if (closeDetailBtn) {
            closeDetailBtn.addEventListener('click', () => this.hideRecipeDetail());
        }

        const editFromDetailBtn = document.getElementById('edit-recipe-from-detail');
        if (editFromDetailBtn) {
            editFromDetailBtn.addEventListener('click', () => this.editRecipeFromDetail());
        }

        const markCookedFromDetailBtn = document.getElementById('mark-cooked-from-detail');
        if (markCookedFromDetailBtn) {
            markCookedFromDetailBtn.addEventListener('click', async (e) => {
                const recipeId = e.currentTarget.dataset.recipeId;
                const recipeName = e.currentTarget.dataset.recipeName;
                await this.markRecipeAsCooked(recipeId, recipeName);
                // Refresh detail view
                if (this.viewingRecipe) {
                    await this.viewRecipe(recipeId);
                }
            });
        }

        const favoriteFromDetailBtn = document.getElementById('favorite-from-detail');
        if (favoriteFromDetailBtn) {
            favoriteFromDetailBtn.addEventListener('click', async (e) => {
                const recipeId = e.currentTarget.dataset.recipeId;
                await this.toggleFavorite(recipeId);
                // Refresh detail view
                if (this.viewingRecipe) {
                    await this.viewRecipe(recipeId);
                }
            });
        }

        const analyzeBtn = document.getElementById('analyze-recipe-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const recipeId = e.currentTarget.dataset.recipeId;
                await this.analyzeRecipe(recipeId);
            });
        }

        const openVariantBtn = document.getElementById('open-variant-modal-btn');
        if (openVariantBtn) {
            openVariantBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const recipeId = e.currentTarget.dataset.recipeId;
                await this.showVariantSelector(recipeId);
            });
        }

        // Delete recipe buttons
        document.querySelectorAll('.delete-recipe-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const recipeId = e.target.dataset.recipeId;
                await this.deleteRecipe(recipeId);
            });
        });

        // Duplicate recipe buttons
        document.querySelectorAll('.duplicate-recipe-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const recipeId = e.target.dataset.recipeId;
                await this.duplicateRecipe(recipeId);
            });
        });

        // Scale portions buttons
        document.querySelectorAll('.scale-portions-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const recipeId = e.target.dataset.recipeId;
                await this.showPortionScaling(recipeId);
            });
        });

        // Favorite toggle buttons
        document.querySelectorAll('.favorite-toggle-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const recipeId = btn.dataset.recipeId;
                await this.toggleFavorite(recipeId);
            });
        });

        // Quick access buttons
        document.querySelectorAll('.favorite-quick-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const recipeId = btn.dataset.recipeId;
                this.focusRecipeCard(recipeId);
            });
        });

        // Portion scaling modal listeners
        const closeScalingBtn = document.getElementById('close-portion-scaling');
        if (closeScalingBtn) {
            closeScalingBtn.addEventListener('click', () => this.hidePortionScaling());
        }

        const calculateBtn = document.getElementById('calculate-portions-btn');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', async () => {
                const newServings = parseInt(document.getElementById('new-servings-input').value);
                if (newServings && newServings > 0) {
                    await this.calculateScaledPortions(newServings);
                }
            });
        }

        // Form close buttons
        const closeBtn = document.getElementById('close-recipe-form');
        const cancelBtn = document.getElementById('cancel-recipe-form');
        if (closeBtn) closeBtn.addEventListener('click', () => this.hideRecipeForm());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideRecipeForm());

        // Meal-prep checkbox toggle
        const mealPrepCheckbox = document.getElementById('recipe-meal-prep-suitable');
        const mealPrepFields = document.getElementById('meal-prep-fields');
        if (mealPrepCheckbox && mealPrepFields) {
            mealPrepCheckbox.addEventListener('change', () => {
                mealPrepFields.classList.toggle('hidden', !mealPrepCheckbox.checked);
            });
        }

        // Add ingredient button
        const addIngBtn = document.getElementById('add-ingredient-btn');
        if (addIngBtn) {
            addIngBtn.addEventListener('click', () => {
                this.ingredients.push({ name: '', amount: '', unit: '', category: 'Sonstiges' });
                this.renderIngredients();
            });
        }

        // Recipe form submit
        const form = document.getElementById('recipe-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveRecipe();
            });
        }

        const analysisBackdrop = document.getElementById('analysis-modal-backdrop');
        if (analysisBackdrop) {
            analysisBackdrop.addEventListener('click', (e) => {
                if (e.target === analysisBackdrop) {
                    this.hideAnalysisModal();
                }
            });
        }

        const closeAnalysisModalBtn = document.getElementById('close-analysis-modal');
        if (closeAnalysisModalBtn) {
            closeAnalysisModalBtn.addEventListener('click', () => this.hideAnalysisModal());
        }

        const closeAnalysisBtn = document.getElementById('close-analysis-btn');
        if (closeAnalysisBtn) {
            closeAnalysisBtn.addEventListener('click', () => this.hideAnalysisModal());
        }

        const variantBackdrop = document.getElementById('variant-modal-backdrop');
        if (variantBackdrop) {
            variantBackdrop.addEventListener('click', (e) => {
                if (e.target === variantBackdrop) {
                    this.hideVariantModal();
                }
            });
        }

        const closeVariantModalBtn = document.getElementById('close-variant-modal');
        if (closeVariantModalBtn) {
            closeVariantModalBtn.addEventListener('click', () => this.hideVariantModal());
        }

        const closeVariantBtn = document.getElementById('close-variant-btn');
        if (closeVariantBtn) {
            closeVariantBtn.addEventListener('click', () => this.hideVariantModal());
        }

        const backToVariantsBtn = document.getElementById('back-to-variants-btn');
        if (backToVariantsBtn) {
            backToVariantsBtn.addEventListener('click', () => {
                this.variantData = null;
                this.isGeneratingVariant = false;
                App.render();
            });
        }

        const saveVariantBtn = document.getElementById('save-variant-btn');
        if (saveVariantBtn) {
            saveVariantBtn.addEventListener('click', async () => {
                await this.saveVariantAsNewRecipe();
            });
        }

        document.querySelectorAll('.variant-type-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (this.isGeneratingVariant) return;
                const variantType = e.currentTarget.dataset.variantType;
                await this.generateVariant(variantType);
            });
        });

        this.renderIngredients();
    },

    filterRecipes() {
        // Helper function to apply time and difficulty filters
        const applyTimeAndDifficultyFilters = (recipes) => {
            // Filter by max total time
            if (this.maxTimeFilter) {
                recipes = recipes.filter(recipe => {
                    const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
                    return totalTime > 0 && totalTime <= this.maxTimeFilter;
                });
            }

            // Filter by difficulty
            if (this.difficultyFilter) {
                recipes = recipes.filter(recipe => recipe.difficulty === this.difficultyFilter);
            }

            return recipes;
        };

        // If we have AI search results, use those
        if (this.aiSearchActive && this.aiSearchResults && this.aiSearchResults.length > 0) {
            let recipes = this.aiSearchResults;

            if (this.showFavoritesOnly) {
                recipes = recipes.filter(recipe => recipe.is_favorite);
            }

            if (this.showSeasonalOnly) {
                const seasonalIds = this.getSeasonalRecipeIds();
                recipes = recipes.filter(recipe => seasonalIds.has(recipe.id));
            }

            if (this.showMealPrepOnly) {
                recipes = recipes.filter(recipe => recipe.is_meal_prep_suitable);
            }

            return applyTimeAndDifficultyFilters(recipes);
        }

        let recipes = AppState.recipes;

        if (this.showFavoritesOnly) {
            recipes = recipes.filter(recipe => recipe.is_favorite);
        }

        // Filter by seasonal recipes
        if (this.showSeasonalOnly) {
            const seasonalIds = this.getSeasonalRecipeIds();
            recipes = recipes.filter(recipe => seasonalIds.has(recipe.id));
        }

        // Filter by meal-prep suitable
        if (this.showMealPrepOnly) {
            recipes = recipes.filter(recipe => recipe.is_meal_prep_suitable);
        }

        // Apply time and difficulty filters
        recipes = applyTimeAndDifficultyFilters(recipes);

        // Don't filter by keyword when AI search is active (waiting for user to click search)
        if (this.aiSearchActive || !this.searchQuery.trim()) {
            return recipes;
        }

        const query = this.searchQuery.toLowerCase().trim();

        return recipes.filter(recipe => {
            // Search in recipe name
            if (recipe.name.toLowerCase().includes(query)) {
                return true;
            }

            // Search in category
            if (recipe.category && recipe.category.toLowerCase().includes(query)) {
                return true;
            }

            // Search in ingredients
            if (recipe.ingredients && recipe.ingredients.some(ingredient =>
                ingredient.name.toLowerCase().includes(query)
            )) {
                return true;
            }

            return false;
        });
    },

    async performAiSearch() {
        if (!this.searchQuery.trim() || this.isAiSearching) return;

        this.isAiSearching = true;
        this.aiSearchResults = null;
        this.aiSearchInfo = null;
        App.render();

        try {
            const result = await StorageService.aiSearch(this.searchQuery, AppState.recipes);
            this.aiSearchResults = result.results || [];
            this.aiSearchInfo = result.searchInfo || { query: this.searchQuery, matchCount: 0, aiPowered: false };
        } catch (error) {
            console.error('AI search failed:', error);
            showToast('KI-Suche fehlgeschlagen', 'error');
            this.aiSearchInfo = {
                query: this.searchQuery,
                matchCount: 0,
                aiPowered: false,
                fallbackReason: error.message
            };
        } finally {
            this.isAiSearching = false;
            App.render();
        }
    },

    renderIngredients() {
        const container = document.getElementById('ingredients-container');
        if (!container) return;

        container.innerHTML = this.ingredients.map((ing, index) => `
            <div class="flex gap-2 mb-2">
                <input type="text" placeholder="Zutat" value="${ing.name}" data-index="${index}" data-field="name"
                       class="ingredient-input flex-1 px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                <input type="text" placeholder="Menge" value="${ing.amount}" data-index="${index}" data-field="amount"
                       class="ingredient-input w-20 px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                <input type="text" placeholder="Einheit" value="${ing.unit}" data-index="${index}" data-field="unit"
                       class="ingredient-input w-20 px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                <select data-index="${index}" data-field="category" title="Kategorie (wird automatisch erkannt)"
                        class="ingredient-input ingredient-category-select w-40 px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                    ${this.categories.map(cat => `
                        <option value="${cat}" ${(ing.category || 'Sonstiges') === cat ? 'selected' : ''}>${cat}</option>
                    `).join('')}
                </select>
                <button type="button" class="remove-ingredient-btn px-3 py-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300" data-index="${index}">
                    ✕
                </button>
            </div>
        `).join('');

        // Attach ingredient input listeners
        document.querySelectorAll('.ingredient-input').forEach(input => {
            const eventType = input.tagName === 'SELECT' ? 'change' : 'input';
            input.addEventListener(eventType, async (e) => {
                const index = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;
                this.ingredients[index][field] = e.target.value;

                // Auto-categorize when ingredient name changes
                if (field === 'name' && e.target.value.trim()) {
                    // Debounce the categorization
                    if (this.categorizationTimeout) {
                        clearTimeout(this.categorizationTimeout);
                    }

                    this.categorizationTimeout = setTimeout(async () => {
                        const category = await this.categorizeIngredient(e.target.value);
                        this.ingredients[index].category = category;

                        // Update only the category dropdown for this ingredient
                        const categorySelect = document.querySelector(`select[data-index="${index}"][data-field="category"]`);
                        if (categorySelect) {
                            categorySelect.value = category;
                        }
                    }, 500); // Wait 500ms after user stops typing
                }
            });
        });

        // Attach remove ingredient listeners
        document.querySelectorAll('.remove-ingredient-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.ingredients.splice(index, 1);
                if (this.ingredients.length === 0) {
                    this.ingredients = [{ name: '', amount: '', unit: '', category: 'Sonstiges' }];
                }
                this.renderIngredients();
            });
        });
    },

    async toggleFavorite(recipeId) {
        const recipe = AppState.recipes.find(item => item.id === recipeId);
        if (!recipe) {
            return;
        }

        const nextState = !recipe.is_favorite;

        try {
            const result = await StorageService.toggleFavorite(recipeId, nextState);
            recipe.is_favorite = result.is_favorite;
            await OfflineDB.saveRecipes(AppState.recipes);

            App.render();
            requestAnimationFrame(() => {
                this.animateFavoriteHeart(recipeId);
            });

            const message = recipe.is_favorite ? 'Rezept zu Favoriten hinzugefügt' : 'Rezept aus Favoriten entfernt';
            const type = recipe.is_favorite ? 'success' : 'default';
            Toast.show(message, { type });
        } catch (error) {
            console.error('Error toggling favorite:', error);
            Toast.error('Favoritenstatus konnte nicht aktualisiert werden');
        }
    },

    focusRecipeCard(recipeId) {
        this.searchQuery = '';
        this.aiSearchActive = false;
        this.aiSearchResults = null;
        this.aiSearchInfo = null;
        App.render();

        requestAnimationFrame(() => {
            const card = document.querySelector(`.recipe-card[data-recipe-card-id="${recipeId}"]`);
            if (!card) return;

            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.classList.add('favorite-highlight');
            setTimeout(() => {
                card.classList.remove('favorite-highlight');
            }, 1200);
        });
    },

    animateFavoriteHeart(recipeId) {
        const heartButton = document.querySelector(`.favorite-toggle-btn[data-recipe-id="${recipeId}"]`);
        if (!heartButton) return;

        heartButton.classList.add('favorite-heart-animate');
        setTimeout(() => heartButton.classList.remove('favorite-heart-animate'), 400);
    },

    renderPortionScalingModal() {
        if (!this.scalingRecipe) return '';

        return `
            <div id="portion-scaling-modal" class="modal active">
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
                    <div class="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                        <h3 class="text-xl font-semibold text-gray-800 dark:text-white">
                            Portionen anpassen - ${this.scalingRecipe.name}
                        </h3>
                        <button id="close-portion-scaling" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl">
                            ✕
                        </button>
                    </div>
                    <div class="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                        <div class="space-y-6">
                            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <p class="text-sm text-blue-800 dark:text-blue-300">
                                    Original: <strong>${this.scalingRecipe.servings} Portionen</strong>
                                </p>
                                <div class="mt-3">
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Neue Portionsanzahl:
                                    </label>
                                    <input type="number" id="new-servings-input" min="1" value="${this.newServings || this.scalingRecipe.servings}"
                                           class="w-full px-4 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                                </div>
                                <button id="calculate-portions-btn"
                                        class="mt-3 w-full px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors ${this.isScaling ? 'opacity-50 cursor-not-allowed' : ''}"
                                        ${this.isScaling ? 'disabled' : ''}>
                                    ${this.isScaling ? 'Berechne...' : '🤖 Mengen berechnen'}
                                </button>
                            </div>

                            ${this.scaledIngredients ? `
                                <div>
                                    <h4 class="font-semibold text-gray-800 dark:text-white mb-3">
                                        Angepasste Zutaten (${this.newServings} Portionen):
                                    </h4>
                                    <div class="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4 space-y-2">
                                        ${this.scaledIngredients.map(ing => `
                                            <div class="flex justify-between items-center py-2 border-b dark:border-gray-700 last:border-0">
                                                <span class="text-gray-800 dark:text-gray-200">${ing.name}</span>
                                                <span class="font-medium text-green-600 dark:text-green-400">
                                                    ${ing.amount} ${ing.unit}
                                                </span>
                                            </div>
                                        `).join('')}
                                    </div>
                                    <div class="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                        <p class="text-sm text-green-800 dark:text-green-300">
                                            ✓ Die Mengen wurden intelligent gerundet und optimiert.
                                        </p>
                                        <p class="text-xs text-green-700 dark:text-green-400 mt-1">
                                            Hinweis: Die Original-Portionen bleiben in der Datenbank gespeichert.
                                        </p>
                                    </div>
                                </div>
                            ` : `
                                <div class="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4">
                                    <h4 class="font-semibold text-gray-800 dark:text-white mb-3">
                                        Aktuelle Zutaten (${this.scalingRecipe.servings} Portionen):
                                    </h4>
                                    <div class="space-y-2">
                                        ${this.scalingRecipe.ingredients.map(ing => `
                                            <div class="flex justify-between items-center py-2 border-b dark:border-gray-700 last:border-0">
                                                <span class="text-gray-800 dark:text-gray-200">${ing.name}</span>
                                                <span class="text-gray-600 dark:text-gray-400">
                                                    ${ing.amount} ${ing.unit}
                                                </span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async showRecipeForm(recipe = null) {
        this.editingRecipe = recipe;

        if (recipe) {
            this.ingredients = recipe.ingredients.length > 0 ?
                recipe.ingredients.map(ing => ({ ...ing, category: ing.category || 'Sonstiges' })) :
                [{ name: '', amount: '', unit: '', category: 'Sonstiges' }];
            this.tags = recipe.tags || [];
        } else {
            this.ingredients = [{ name: '', amount: '', unit: '', category: 'Sonstiges' }];
            this.tags = [];
        }

        await App.render();

        // Populate form
        if (recipe) {
            document.getElementById('recipe-name').value = recipe.name || '';
            document.getElementById('recipe-category').value = recipe.category || '';
            document.getElementById('recipe-servings').value = recipe.servings || '';
            document.getElementById('recipe-instructions').value = recipe.instructions || '';
            document.getElementById('recipe-prep-time').value = recipe.prep_time || '';
            document.getElementById('recipe-cook-time').value = recipe.cook_time || '';
            document.getElementById('recipe-difficulty').value = recipe.difficulty || '';

            // Meal-prep fields
            const mealPrepCheckbox = document.getElementById('recipe-meal-prep-suitable');
            const mealPrepFields = document.getElementById('meal-prep-fields');
            if (mealPrepCheckbox) {
                mealPrepCheckbox.checked = recipe.is_meal_prep_suitable || false;
                if (mealPrepFields) {
                    mealPrepFields.classList.toggle('hidden', !mealPrepCheckbox.checked);
                }
            }
            document.getElementById('recipe-fridge-days').value = recipe.meal_prep_fridge_days || '';
            document.getElementById('recipe-freezer-days').value = recipe.meal_prep_freezer_days || '';
            document.getElementById('recipe-reheat-tips').value = recipe.meal_prep_reheat_tips || '';
            document.getElementById('recipe-batch-notes').value = recipe.meal_prep_batch_notes || '';
        }

        // Attach all form event listeners after render
        // Recipe form submit
        const form = document.getElementById('recipe-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveRecipe();
            });
        }

        // Add ingredient button
        const addIngBtn = document.getElementById('add-ingredient-btn');
        if (addIngBtn) {
            addIngBtn.addEventListener('click', () => {
                this.ingredients.push({ name: '', amount: '', unit: '', category: 'Sonstiges' });
                this.renderIngredients();
            });
        }

        // Meal-prep checkbox toggle
        const mealPrepCheckbox = document.getElementById('recipe-meal-prep-suitable');
        const mealPrepFields = document.getElementById('meal-prep-fields');
        if (mealPrepCheckbox && mealPrepFields) {
            mealPrepCheckbox.addEventListener('change', () => {
                mealPrepFields.classList.toggle('hidden', !mealPrepCheckbox.checked);
            });
        }

        // Attach tag event listeners
        this.attachTagEventListeners();

        const modal = document.getElementById('recipe-form-modal');
        if (modal) {
            modal.classList.add('active');
            this._releaseFocusTrap = trapFocus(modal);
        }
    },

    hideRecipeForm() {
        if (this._releaseFocusTrap) {
            this._releaseFocusTrap();
            this._releaseFocusTrap = null;
        }
        const modal = document.getElementById('recipe-form-modal');
        if (modal) modal.classList.remove('active');
        this.editingRecipe = null;
        this.tags = [];
    },

    updateTagsUI() {
        // Update selected tags container
        const selectedTagsContainer = document.getElementById('selected-tags-container');
        if (selectedTagsContainer) {
            selectedTagsContainer.innerHTML = this.tags.map(tag => `
                <span class="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded-full text-sm">
                    ${tag}
                    <button type="button" class="remove-tag-btn hover:text-blue-600 dark:hover:text-blue-200" data-tag="${tag}">✕</button>
                </span>
            `).join('');
        }

        // Update available tags buttons
        document.querySelectorAll('.add-tag-btn').forEach(btn => {
            const tag = btn.dataset.tag;
            const isSelected = this.tags.includes(tag);
            if (isSelected) {
                btn.classList.add('opacity-50', 'cursor-not-allowed');
                btn.disabled = true;
            } else {
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                btn.disabled = false;
            }
        });

        // Re-attach event listeners for remove buttons
        document.querySelectorAll('.remove-tag-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tag = e.target.dataset.tag;
                this.tags = this.tags.filter(t => t !== tag);
                this.updateTagsUI();
            });
        });
    },

    attachTagEventListeners() {
        // Add tag buttons
        document.querySelectorAll('.add-tag-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tag = e.target.dataset.tag;
                if (!this.tags.includes(tag)) {
                    this.tags.push(tag);
                    this.updateTagsUI();
                }
            });
        });

        // Remove tag buttons (initial setup)
        document.querySelectorAll('.remove-tag-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tag = e.target.dataset.tag;
                this.tags = this.tags.filter(t => t !== tag);
                this.updateTagsUI();
            });
        });
    },

    async viewRecipe(recipeId) {
        const recipe = await StorageService.getRecipeById(recipeId);
        if (recipe) {
            this.viewingRecipe = recipe;
            App.render();
        }
    },

    hideRecipeDetail() {
        this.viewingRecipe = null;
        App.render();
    },

    async editRecipe(recipeId) {
        const recipe = await StorageService.getRecipeById(recipeId);
        if (recipe) {
            this.viewingRecipe = null; // Close detail view if open
            await this.showRecipeForm(recipe);
        }
    },

    async editRecipeFromDetail() {
        if (this.viewingRecipe) {
            const recipeId = this.viewingRecipe.id;
            this.viewingRecipe = null;
            await this.editRecipe(recipeId);
        }
    },

    async deleteRecipe(recipeId) {
        if (confirm('Möchtest du dieses Rezept wirklich löschen?')) {
            // Get recipe data before deleting
            const recipe = await StorageService.getRecipeById(recipeId);
            if (!recipe) return;

            // Delete recipe
            await StorageService.deleteRecipe(recipeId);
            await AppState.reloadData();
            App.render();

            // Define undo function
            const undoDelete = async () => {
                await StorageService.addRecipe(recipe);
                await AppState.reloadData();
                App.render();
                Toast.success(`Rezept "${recipe.name}" wiederhergestellt`);
            };

            // Add to action history for Ctrl+Z
            ActionHistory.addAction({
                undo: undoDelete,
                undoMessage: `Rezept "${recipe.name}" wiederhergestellt`
            });

            // Show toast with undo option
            Toast.show(`Rezept "${recipe.name}" gelöscht`, {
                showUndo: true,
                onUndo: undoDelete
            });
        }
    },

    async duplicateRecipe(recipeId) {
        const recipe = await StorageService.getRecipeById(recipeId);
        if (!recipe) return;

        // Create duplicate with new ID and modified name
        const duplicatedRecipe = {
            ...recipe,
            id: Date.now().toString(),
            name: `${recipe.name} (Kopie)`,
            ingredients: recipe.ingredients.map(ing => ({ ...ing })) // Deep copy ingredients
        };

        duplicatedRecipe.is_favorite = false;

        await StorageService.addRecipe(duplicatedRecipe);
        await AppState.reloadData();

        // Open the duplicated recipe in edit mode
        await this.showRecipeForm(duplicatedRecipe);
    },

    async markRecipeAsCooked(recipeId, recipeName) {
        try {
            await StorageService.markAsCooked(recipeId);
            Toast.success(`"${recipeName}" als gekocht markiert`);
            // Refresh cooking stats
            this.cookingStats = null;
            await this.loadCookingStats();
        } catch (error) {
            Toast.error('Fehler beim Markieren als gekocht');
            console.error(error);
        }
    },

    // ========== AI RECIPE ANALYSIS & VARIANTS ==========

    async loadVariantTypes() {
        if (!this.variantTypes) {
            const result = await StorageService.getVariantTypes();
            this.variantTypes = result.variantTypes || [];
        }
        return this.variantTypes;
    },

    async analyzeRecipe(recipeId) {
        const recipe = await StorageService.getRecipeById(recipeId);
        if (!recipe) {
            Toast.error('Rezept nicht gefunden');
            return;
        }

        this.isAnalyzing = true;
        this.analysisData = null;
        this.showAnalysisModal = true;
        App.render();

        try {
            const analysis = await StorageService.analyzeRecipe(recipe);
            this.analysisData = analysis;
            this.isAnalyzing = false;
            App.render();
        } catch (error) {
            this.isAnalyzing = false;
            this.showAnalysisModal = false;
            Toast.error('Fehler bei der Rezeptanalyse: ' + error.message);
            App.render();
        }
    },

    hideAnalysisModal() {
        this.showAnalysisModal = false;
        this.analysisData = null;
        this.isAnalyzing = false;
        App.render();
    },

    async showVariantSelector(recipeId) {
        await this.loadVariantTypes();
        const recipe = await StorageService.getRecipeById(recipeId);
        if (!recipe) {
            Toast.error('Rezept nicht gefunden');
            return;
        }

        this.viewingRecipe = recipe;
        this.showVariantModal = true;
        this.variantData = null;
        App.render();
    },

    async generateVariant(variantType) {
        if (!this.viewingRecipe) return;

        this.isGeneratingVariant = true;
        this.variantData = null;
        App.render();

        try {
            const variant = await StorageService.generateRecipeVariant(this.viewingRecipe, variantType);
            this.variantData = variant;
            this.isGeneratingVariant = false;
            App.render();
        } catch (error) {
            this.isGeneratingVariant = false;
            Toast.error('Fehler bei der Varianten-Generierung: ' + error.message);
            App.render();
        }
    },

    hideVariantModal() {
        this.showVariantModal = false;
        this.variantData = null;
        this.isGeneratingVariant = false;
        App.render();
    },

    async saveVariantAsNewRecipe() {
        if (!this.variantData) return;

        try {
            // Clean up ingredients (remove isNew and replaces fields)
            const cleanIngredients = this.variantData.ingredients.map(ing => ({
                name: ing.name,
                amount: ing.amount,
                unit: ing.unit,
                category: ing.category
            }));

            const newRecipe = {
                id: `variant-${Date.now()}`,
                name: this.variantData.variantName,
                category: this.variantData.category,
                servings: this.variantData.servings,
                instructions: this.variantData.instructions,
                ingredients: cleanIngredients,
                tags: [this.variantData.variantType],
                is_favorite: false
            };

            await StorageService.addRecipe(newRecipe);
            await AppState.reloadData();
            Toast.success(`Variante "${newRecipe.name}" gespeichert!`);
            this.hideVariantModal();
            App.render();
        } catch (error) {
            Toast.error('Fehler beim Speichern: ' + error.message);
        }
    },

    getAnalysisIcon(iconType) {
        const icons = {
            taste: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`,
            health: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`,
            time: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
            chef: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>`
        };
        return icons[iconType] || icons.chef;
    },

    renderAnalysisModal() {
        if (!this.showAnalysisModal) return '';

        const loadingContent = `
            <div class="flex flex-col items-center justify-center py-12">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
                <p class="text-gray-600 dark:text-gray-400">Analysiere Rezept mit KI...</p>
                <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">Dies kann einige Sekunden dauern</p>
            </div>
        `;

        const analysisContent = this.analysisData ? `
            <div class="space-y-4">
                <!-- Overall Rating -->
                <div class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-4">
                    <h4 class="font-medium text-gray-800 dark:text-white mb-3">Gesamtbewertung</h4>
                    <div class="grid grid-cols-3 gap-4 mb-3">
                        <div class="text-center">
                            <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">${this.analysisData.overallRating?.taste || '-'}/5</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">Geschmack</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-green-600 dark:text-green-400">${this.analysisData.overallRating?.health || '-'}/5</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">Gesundheit</div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">${this.analysisData.overallRating?.difficulty || '-'}/5</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">Schwierigkeit</div>
                        </div>
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">${this.analysisData.overallRating?.comment || ''}</p>
                </div>

                <!-- Suggestions -->
                <div class="space-y-3">
                    ${(this.analysisData.suggestions || []).map(suggestion => `
                        <div class="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                            <div class="flex items-start gap-3">
                                <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                                    suggestion.icon === 'taste' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400' :
                                    suggestion.icon === 'health' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                                    suggestion.icon === 'time' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                                    'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                }">
                                    ${this.getAnalysisIcon(suggestion.icon)}
                                </div>
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="text-xs font-medium px-2 py-0.5 rounded-full ${
                                            suggestion.icon === 'taste' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300' :
                                            suggestion.icon === 'health' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                            suggestion.icon === 'time' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                                            'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                        }">${suggestion.category}</span>
                                        ${suggestion.impact === 'high' ? '<span class="text-xs text-green-600 dark:text-green-400 font-medium">Hoher Einfluss</span>' : ''}
                                    </div>
                                    <h5 class="font-medium text-gray-800 dark:text-white">${suggestion.title}</h5>
                                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${suggestion.description}</p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '';

        return `
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" id="analysis-modal-backdrop">
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b dark:border-gray-700 flex-shrink-0">
                        <div class="flex items-center gap-2">
                            <span class="text-xl">🤖</span>
                            <h3 class="text-lg font-semibold text-gray-800 dark:text-white">KI-Rezeptanalyse</h3>
                        </div>
                        <button id="close-analysis-modal" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                            <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="flex-1 overflow-y-auto p-4">
                        ${this.isAnalyzing ? loadingContent : analysisContent}
                    </div>
                    <div class="p-4 border-t dark:border-gray-700 flex-shrink-0">
                        <button id="close-analysis-btn" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                            Schließen
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    renderVariantModal() {
        if (!this.showVariantModal) return '';

        const variantTypesHtml = (this.variantTypes || []).map(vt => `
            <button class="variant-type-btn flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${this.isGeneratingVariant ? 'opacity-50 cursor-not-allowed' : ''}" data-variant-type="${vt.id}" ${this.isGeneratingVariant ? 'disabled' : ''}>
                <span class="text-2xl">${vt.icon}</span>
                <div class="text-left">
                    <div class="font-medium text-gray-800 dark:text-white">${vt.name}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">${vt.description}</div>
                </div>
            </button>
        `).join('');
        const hasVariantTypes = Array.isArray(this.variantTypes) && this.variantTypes.length > 0;
        const variantSelectionHtml = `
            <div class="space-y-3">
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Wähle eine Variante, die du von diesem Rezept erstellen möchtest:</p>
                ${hasVariantTypes ? variantTypesHtml : '<div class="p-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400">Keine Varianten verfügbar. Bitte prüfe deine KI-Konfiguration oder versuche es später erneut.</div>'}
            </div>
        `;

        const loadingContent = `
            <div class="flex flex-col items-center justify-center py-8">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
                <p class="text-gray-600 dark:text-gray-400">Generiere Variante mit KI...</p>
                <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">Dies kann einige Sekunden dauern</p>
            </div>
        `;

        const variantResultHtml = this.variantData ? `
            <div class="space-y-4">
                <div class="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-xl">${(this.variantTypes || []).find(v => v.id === this.variantData.variantType)?.icon || '🍽️'}</span>
                        <h4 class="font-semibold text-gray-800 dark:text-white">${this.variantData.variantName}</h4>
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">${this.variantData.nutritionNote || ''}</p>
                    <div class="flex gap-4 mt-3 text-sm">
                        <span class="text-gray-500 dark:text-gray-400">${this.variantData.servings} Portionen</span>
                        <span class="text-gray-500 dark:text-gray-400">${this.variantData.prepTime || ''}</span>
                        <span class="text-gray-500 dark:text-gray-400">${this.variantData.difficulty || ''}</span>
                    </div>
                </div>

                <div>
                    <h5 class="font-medium text-gray-800 dark:text-white mb-2">Wichtigste Änderungen:</h5>
                    <ul class="space-y-1">
                        ${(this.variantData.changes || []).map(change => `
                            <li class="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <span class="text-green-500 mt-0.5">✓</span>
                                ${change}
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <div>
                    <h5 class="font-medium text-gray-800 dark:text-white mb-2">Zutaten (${this.variantData.ingredients?.length || 0}):</h5>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                        ${(this.variantData.ingredients || []).map(ing => `
                            <div class="flex items-center gap-2 text-sm ${ing.isNew ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}">
                                ${ing.isNew ? '<span class="text-xs bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">Neu</span>' : ''}
                                <span>${ing.amount || ''} ${ing.unit || ''} ${ing.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <button id="save-variant-btn" class="w-full px-4 py-3 bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                    Als neues Rezept speichern
                </button>
            </div>
        ` : '';

        return `
            <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" id="variant-modal-backdrop">
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b dark:border-gray-700 flex-shrink-0">
                        <div class="flex items-center gap-2">
                            <span class="text-xl">🔄</span>
                            <div>
                                <h3 class="text-lg font-semibold text-gray-800 dark:text-white">Rezept-Variante erstellen</h3>
                                <p class="text-sm text-gray-500 dark:text-gray-400">${this.viewingRecipe?.name || ''}</p>
                            </div>
                        </div>
                        <button id="close-variant-modal" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                            <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="flex-1 overflow-y-auto p-4">
                        ${this.isGeneratingVariant ? loadingContent : (this.variantData ? variantResultHtml : variantSelectionHtml)}
                    </div>
                    <div class="p-4 border-t dark:border-gray-700 flex-shrink-0">
                        ${this.variantData ? `
                            <button id="back-to-variants-btn" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                Andere Variante wählen
                            </button>
                        ` : `
                            <button id="close-variant-btn" class="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                Abbrechen
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    },

    async saveRecipe() {
        const name = document.getElementById('recipe-name').value.trim();
        const category = document.getElementById('recipe-category').value.trim();
        const servings = document.getElementById('recipe-servings').value;
        const instructions = document.getElementById('recipe-instructions').value.trim();
        const prepTime = document.getElementById('recipe-prep-time')?.value;
        const cookTime = document.getElementById('recipe-cook-time')?.value;
        const difficulty = document.getElementById('recipe-difficulty')?.value;

        // Meal-prep fields
        const isMealPrepSuitable = document.getElementById('recipe-meal-prep-suitable')?.checked || false;
        const fridgeDays = document.getElementById('recipe-fridge-days')?.value;
        const freezerDays = document.getElementById('recipe-freezer-days')?.value;
        const reheatTips = document.getElementById('recipe-reheat-tips')?.value?.trim();
        const batchNotes = document.getElementById('recipe-batch-notes')?.value?.trim();

        if (!name) {
            Toast.error('Bitte gib einen Rezeptnamen ein.');
            return;
        }

        const validIngredients = this.ingredients.filter(ing => ing.name.trim() !== '');

        const recipe = {
            id: this.editingRecipe?.id || Date.now().toString(),
            name,
            category: category || undefined,
            servings: servings ? parseInt(servings) : undefined,
            instructions: instructions || undefined,
            ingredients: validIngredients,
            tags: this.tags,
            is_favorite: this.editingRecipe?.is_favorite ?? false,
            prep_time: prepTime ? parseInt(prepTime) : undefined,
            cook_time: cookTime ? parseInt(cookTime) : undefined,
            difficulty: difficulty || undefined,
            is_meal_prep_suitable: isMealPrepSuitable,
            meal_prep_fridge_days: fridgeDays ? parseInt(fridgeDays) : undefined,
            meal_prep_freezer_days: freezerDays ? parseInt(freezerDays) : undefined,
            meal_prep_reheat_tips: reheatTips || undefined,
            meal_prep_batch_notes: batchNotes || undefined
        };

        if (this.editingRecipe) {
            await StorageService.updateRecipe(recipe);
            Toast.success(`Rezept "${name}" aktualisiert ✓`);
        } else {
            await StorageService.addRecipe(recipe);
            Toast.success(`Rezept "${name}" gespeichert ✓`);
        }

        await AppState.reloadData();
        this.hideRecipeForm();
        App.render();
    },

    async showPortionScaling(recipeId) {
        const recipe = await StorageService.getRecipeById(recipeId);
        if (recipe) {
            this.scalingRecipe = recipe;
            this.newServings = recipe.servings;
            this.scaledIngredients = null;
            this.isScaling = false;
            App.render();
        }
    },

    hidePortionScaling() {
        this.scalingRecipe = null;
        this.scaledIngredients = null;
        this.newServings = null;
        this.isScaling = false;
        App.render();
    },

    async calculateScaledPortions(newServings) {
        if (!this.scalingRecipe || !newServings) return;

        this.isScaling = true;
        this.newServings = newServings;
        App.render();

        try {
            const response = await fetch(`${API_BASE_URL}/ai/scale-portions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ingredients: this.scalingRecipe.ingredients,
                    originalServings: this.scalingRecipe.servings,
                    newServings: newServings
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to scale portions');
            }

            const data = await response.json();
            this.scaledIngredients = data.ingredients;
            this.isScaling = false;
            App.render();
        } catch (error) {
            console.error('Error scaling portions:', error);
            Toast.error('Fehler beim Skalieren der Portionen: ' + error.message);
            this.isScaling = false;
            App.render();
        }
    },

    async categorizeIngredient(ingredientName) {
        if (!ingredientName || !ingredientName.trim()) {
            return 'Sonstiges';
        }

        const normalizedName = ingredientName.trim().toLowerCase();

        // Check cache first
        if (this.categoryCache.has(normalizedName)) {
            return this.categoryCache.get(normalizedName);
        }

        try {
            const response = await fetch(`${API_BASE_URL}/ai/categorize-ingredient`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ingredientName: ingredientName
                })
            });

            if (!response.ok) {
                throw new Error('Failed to categorize ingredient');
            }

            const data = await response.json();
            const category = data.category;

            // Cache the result
            this.categoryCache.set(normalizedName, category);

            return category;
        } catch (error) {
            console.error('Error categorizing ingredient:', error);
            // Return default category on error
            return 'Sonstiges';
        }
    }
};
