import { AppState } from '../core/app-state.js';
import { StorageService } from '../core/storage-service.js';
import { Toast } from '../core/toast.js';
import { DateUtils } from '../core/date-utils.js';
import { ActionHistory } from '../core/action-history.js';
import { MobileUtils } from '../core/mobile-utils.js';
import { escapeHtml, trapFocus } from '../core/utils.js';
import { API_BASE_URL } from '../config.js';
import { Auth } from '../core/auth.js';
import { App } from '../app.js';
import { api } from '../core/api.js';

export const WeekPlannerView = {
    selectedDay: null,
    selectedMealType: null,
    mobileViewDay: 0, // Index of day to show on mobile (0-6)
    seasonalRecommendations: null, // Cache for seasonal recommendations

    async loadSeasonalRecommendations() {
        if (!this.seasonalRecommendations) {
            this.seasonalRecommendations = await StorageService.getSeasonalRecommendations(4);
        }
        return this.seasonalRecommendations;
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

    renderSeasonalRecommendations() {
        if (!this.seasonalRecommendations || !this.seasonalRecommendations.recommendations || this.seasonalRecommendations.recommendations.length === 0) {
            return '';
        }

        const { season, seasonKey, recommendations, topSeasonalIngredients } = this.seasonalRecommendations;
        const seasonIcon = this.getSeasonIcon(seasonKey);

        return `
            <section class="ds-card bg-gradient-to-r from-green-50 to-emerald-50 transition-colors duration-200">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                        <span class="text-xl">${seasonIcon}</span>
                        <h3 class="text-base font-semibold text-ds-text">Saisonale Empfehlungen (${season})</h3>
                    </div>
                    <span class="ds-badge ds-badge-accent rounded-full">
                        ${topSeasonalIngredients.slice(0, 3).join(', ')}...
                    </span>
                </div>
                <div class="flex gap-3 overflow-x-auto pb-1">
                    ${recommendations.map(recipe => `
                        <div class="seasonal-recipe-card flex-shrink-0 min-w-[180px] max-w-[200px] px-4 py-3 rounded-lg border border-green-200 bg-white text-left transition-colors hover:bg-green-50 cursor-pointer" data-recipe-id="${recipe.id}">
                            <div class="flex items-start justify-between gap-2 mb-1">
                                <span class="font-medium text-ds-text text-sm line-clamp-2">${escapeHtml(recipe.name)}</span>
                                ${recipe.is_favorite ? `
                                    <svg class="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                                    </svg>
                                ` : ''}
                            </div>
                            <p class="text-xs text-ds-text-muted mb-2">${escapeHtml(recipe.category || 'Rezept')}</p>
                            <div class="flex items-center gap-2">
                                <span class="ds-badge ds-badge-accent rounded-full">
                                    ${recipe.seasonalScore}% saisonal
                                </span>
                            </div>
                            ${recipe.seasonalIngredients && recipe.seasonalIngredients.length > 0 ? `
                                <p class="text-xs text-green-600 mt-2 line-clamp-1" title="${recipe.seasonalIngredients.join(', ')}">
                                    ${seasonIcon} ${recipe.seasonalIngredients.slice(0, 2).join(', ')}${recipe.seasonalIngredients.length > 2 ? '...' : ''}
                                </p>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </section>
        `;
    },

    render() {
        if (!AppState.weekPlan || !AppState.currentWeekStart) {
            return '<div class="text-ds-text">Lade Wochenplan...</div>';
        }

        // Load seasonal recommendations if not loaded
        if (!this.seasonalRecommendations) {
            this.loadSeasonalRecommendations().then(() => App.render());
        }

        const mealTypes = ['Frühstück', 'Mittagessen', 'Abendessen'];
        const weekRange = DateUtils.formatWeekRange(AppState.currentWeekStart);
        const isCurrentWeek = AppState.isCurrentWeek();

        // Find today's index for mobile view
        if (isCurrentWeek) {
            const today = new Date();
            const todayIndex = AppState.weekPlan.days.findIndex(day =>
                DateUtils.isToday(new Date(day.date))
            );
            if (todayIndex >= 0 && this.mobileViewDay !== todayIndex) {
                this.mobileViewDay = todayIndex;
            }
        }

        return `
            <div class="space-y-4 sm:space-y-6">
                <!-- Header with responsive buttons -->
                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <h2 class="ds-page-title">Wochenplan</h2>
                    <div class="flex gap-2 flex-wrap">
                        <button id="ai-generate-btn" class="flex-1 sm:flex-none ds-btn ds-btn-primary flex items-center justify-center gap-2" ${this.aiGenerating ? 'disabled' : ''}>
                            <svg class="w-4 h-4 ${this.aiGenerating ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                ${this.aiGenerating
                                    ? '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>'
                                    : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>'
                                }
                            </svg>
                            <span class="hidden sm:inline">${this.aiGenerating ? 'Generiere...' : 'KI-Vorschläge'}</span>
                            <span class="sm:hidden">${this.aiGenerating ? '...' : 'KI'}</span>
                        </button>
                        <button id="save-template-btn" class="flex-1 sm:flex-none ds-btn ds-btn-secondary">
                            <span class="hidden sm:inline">Als Vorlage speichern</span>
                            <span class="sm:hidden">Speichern</span>
                        </button>
                        <button id="load-template-btn" class="flex-1 sm:flex-none ds-btn ds-btn-secondary">
                            <span class="hidden sm:inline">Aus Vorlage laden</span>
                            <span class="sm:hidden">Laden</span>
                        </button>
                        <button id="reset-week-btn" class="ds-btn ds-btn-destructive">
                            <span class="hidden sm:inline">Zurücksetzen</span>
                            <span class="sm:hidden">Reset</span>
                        </button>
                    </div>
                </div>

                ${this.renderSeasonalRecommendations()}

                <!-- Week Navigation -->
                <div class="ds-card transition-colors duration-200">
                    <div class="flex items-center justify-between">
                        <button id="prev-week-btn" class="p-3 sm:p-2 rounded-lg bg-ds-bg-subtle hover:bg-gray-200 transition-colors active:scale-95" title="Vorherige Woche">
                            <svg class="w-6 h-6 text-ds-text-body" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                            </svg>
                        </button>
                        <div class="text-center flex-1 mx-2">
                            <h3 class="text-base sm:text-xl font-semibold text-ds-text">${weekRange}</h3>
                            ${!isCurrentWeek ? `
                                <button id="go-to-current-week-btn" class="mt-1 text-sm text-blue-500 hover:text-blue-600 transition-colors">
                                    Zur aktuellen Woche
                                </button>
                            ` : '<span class="mt-1 text-sm text-green-600 block">Aktuelle Woche</span>'}
                        </div>
                        <button id="next-week-btn" class="p-3 sm:p-2 rounded-lg bg-ds-bg-subtle hover:bg-gray-200 transition-colors active:scale-95" title="Nächste Woche">
                            <svg class="w-6 h-6 text-ds-text-body" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Mobile Day Selector -->
                <div class="sm:hidden">
                    <div class="flex items-center justify-between mb-3">
                        <button id="prev-day-btn" class="p-2 rounded-lg bg-ds-bg-subtle hover:bg-gray-200 transition-colors active:scale-95 ${this.mobileViewDay <= 0 ? 'opacity-50' : ''}" ${this.mobileViewDay <= 0 ? 'disabled' : ''}>
                            <svg class="w-5 h-5 text-ds-text-body" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                            </svg>
                        </button>
                        <div class="flex gap-1 overflow-x-auto py-1 px-2">
                            ${AppState.weekPlan.days.map((day, index) => {
                                const dayDate = new Date(day.date);
                                const isToday = DateUtils.isToday(dayDate);
                                const dayName = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][index];
                                return `
                                    <button class="day-selector-btn flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                                        this.mobileViewDay === index
                                            ? 'bg-blue-500 text-white'
                                            : isToday
                                                ? 'bg-blue-100 text-blue-600'
                                                : 'bg-ds-bg-subtle text-ds-text-body'
                                    }" data-day-index="${index}">
                                        ${dayName}
                                    </button>
                                `;
                            }).join('')}
                        </div>
                        <button id="next-day-btn" class="p-2 rounded-lg bg-ds-bg-subtle hover:bg-gray-200 transition-colors active:scale-95 ${this.mobileViewDay >= 6 ? 'opacity-50' : ''}" ${this.mobileViewDay >= 6 ? 'disabled' : ''}>
                            <svg class="w-5 h-5 text-ds-text-body" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                            </svg>
                        </button>
                    </div>
                    <!-- Swipe hint -->
                    <p class="text-xs text-center text-ds-text-muted mb-2">← Wischen für Tageswechsel →</p>
                </div>

                <!-- Mobile view: Single day with swipe -->
                <div id="mobile-day-view" class="sm:hidden">
                    ${this.renderDay(AppState.weekPlan.days[this.mobileViewDay], this.mobileViewDay, mealTypes, true)}
                </div>

                <!-- Desktop view: All days -->
                <div class="hidden sm:grid gap-4">
                    ${AppState.weekPlan.days.map((day, dayIndex) => this.renderDay(day, dayIndex, mealTypes, false)).join('')}
                </div>

                ${this.renderRecipeSelector()}
                ${this.renderSaveTemplateModal()}
                ${this.renderLoadTemplateModal()}
                ${this.renderAIGenerateModal()}
            </div>
        `;
    },

    renderDay(day, dayIndex, mealTypes, isMobileView = false) {
        const dayDate = new Date(day.date);
        const formattedDate = DateUtils.formatDateWithDay(dayDate);
        const isToday = DateUtils.isToday(dayDate);
        const isPast = DateUtils.isPast(dayDate);

        return `
            <div class="ds-card transition-colors duration-200 ${isToday ? 'ring-2 ring-blue-500' : ''} ${isPast && !isMobileView ? 'opacity-75' : ''}">
                <div class="flex items-center justify-between gap-2 mb-3">
                    <div class="flex items-center gap-2">
                        <h3 class="ds-section-title text-lg sm:text-xl">${formattedDate}</h3>
                        ${isToday ? '<span class="ds-badge rounded-full">Heute</span>' : ''}
                    </div>
                    ${isPast ? '<span class="text-xs text-ds-text-muted">Vergangen</span>' : ''}
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    ${mealTypes.map(mealType => {
                        const meal = day.meals[mealType];
                        return `
                            <div class="border border-ds-border rounded-lg p-3 sm:p-3">
                                <div class="flex justify-between items-center mb-2">
                                    <h4 class="font-medium text-ds-text-body text-sm sm:text-base">${mealType}</h4>
                                    ${meal ? `
                                        <button class="remove-meal-btn p-2 -mr-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                                data-day="${dayIndex}"
                                                data-meal="${mealType}"
                                                aria-label="Mahlzeit entfernen">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                            </svg>
                                        </button>
                                    ` : ''}
                                </div>
                                ${meal ? `
                                    <div class="bg-blue-50 p-3 rounded-lg">
                                        <p class="text-sm text-ds-text font-medium ${meal.recipeId ? 'cursor-pointer hover:text-blue-600 hover:underline open-recipe-btn' : ''}"
                                           ${meal.recipeId ? `data-recipe-id="${meal.recipeId}"` : ''}>${escapeHtml(meal.recipeName)}</p>
                                        <button class="mark-cooked-btn mt-3 w-full ds-btn ds-btn-secondary flex items-center justify-center gap-2 active:scale-98"
                                                data-recipe-id="${meal.recipeId}"
                                                data-recipe-name="${escapeHtml(meal.recipeName)}">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                            </svg>
                                            Als gekocht markieren
                                        </button>
                                    </div>
                                ` : `
                                    <button class="add-meal-btn w-full py-4 sm:py-3 border-2 border-dashed border-ds-border rounded-lg text-ds-text-muted hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 active:scale-98"
                                            data-day="${dayIndex}"
                                            data-meal="${mealType}">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                                        </svg>
                                        Rezept hinzufügen
                                    </button>
                                `}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    renderSaveTemplateModal() {
        return `
            <div id="save-template-modal" class="modal">
                <div class="ds-card max-w-md w-full p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="ds-section-title text-xl">Vorlage speichern</h3>
                        <button id="close-save-template" class="text-ds-text-muted hover:text-ds-text text-2xl">
                            ✕
                        </button>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-ds-text-body mb-1">
                                Name der Vorlage *
                            </label>
                            <input type="text" id="template-name-input"
                                   class="ds-input"
                                   placeholder="z.B. Standardwoche, Sommerwoche..."
                                   required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-ds-text-body mb-1">
                                Beschreibung (optional)
                            </label>
                            <textarea id="template-description-input"
                                      class="ds-input"
                                      rows="3"
                                      placeholder="Beschreibe diese Vorlage..."></textarea>
                        </div>
                        <div class="flex gap-2 justify-end">
                            <button id="cancel-save-template" class="ds-btn border border-ds-border text-ds-text-body hover:bg-ds-bg-subtle transition-colors">
                                Abbrechen
                            </button>
                            <button id="confirm-save-template" class="ds-btn ds-btn-secondary">
                                Speichern
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderLoadTemplateModal() {
        return `
            <div id="load-template-modal" class="modal">
                <div class="ds-card max-w-2xl w-full max-h-[80vh] overflow-hidden">
                    <div class="p-4 border-b border-ds-border flex justify-between items-center">
                        <h3 class="ds-section-title text-xl">Vorlage laden</h3>
                        <button id="close-load-template" class="text-ds-text-muted hover:text-ds-text text-2xl">
                            ✕
                        </button>
                    </div>
                    <div id="templates-list" class="p-4 overflow-y-auto max-h-[60vh]">
                        <p class="text-ds-text-muted text-center py-8">Lade Vorlagen...</p>
                    </div>
                </div>
            </div>
        `;
    },

    renderRecipeSelector() {
        return `
            <div id="recipe-selector-modal" class="modal">
                <div class="ds-card max-w-2xl w-full max-h-[80vh] overflow-hidden">
                    <div class="p-4 border-b border-ds-border flex justify-between items-center">
                        <h3 class="ds-section-title text-xl">Rezept auswählen</h3>
                        <button id="close-recipe-selector" class="text-ds-text-muted hover:text-ds-text text-2xl">
                            ✕
                        </button>
                    </div>
                    <div class="p-4 overflow-y-auto max-h-[60vh]">
                        ${AppState.recipes.length === 0 ? `
                            <p class="text-ds-text-muted text-center py-8">
                                Noch keine Rezepte vorhanden. Erstelle zuerst Rezepte in der Rezeptdatenbank.
                            </p>
                        ` : `
                            <div class="grid gap-2">
                                ${AppState.recipes.map(recipe => `
                                    <button class="select-recipe-btn text-left p-3 border border-ds-border rounded hover:bg-blue-50 hover:border-blue-400 transition-colors"
                                            data-recipe-id="${recipe.id}">
                                        <p class="font-medium text-ds-text">${escapeHtml(recipe.name)}</p>
                                        ${recipe.category ? `<p class="text-sm text-ds-text-sec">${escapeHtml(recipe.category)}</p>` : ''}
                                    </button>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    },

    renderAIGenerateModal() {
        return `
            <div id="ai-generate-modal" class="modal">
                <div class="ds-card max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="ds-section-title text-xl flex items-center gap-2">
                            <svg class="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                            KI-Wochenplan generieren
                        </h3>
                        <button id="close-ai-generate" class="text-ds-text-muted hover:text-ds-text text-2xl">
                            ✕
                        </button>
                    </div>

                    ${this.aiError ? `
                        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p class="text-red-700 text-sm">${this.aiError}</p>
                        </div>
                    ` : ''}

                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-ds-text-body mb-2">
                                Für welche Mahlzeiten soll die KI Vorschläge erstellen?
                            </label>
                            <div class="space-y-2">
                                <label class="flex items-center gap-3 p-3 border border-ds-border rounded-lg cursor-pointer hover:bg-ds-bg-muted transition-colors">
                                    <input type="checkbox" id="ai-meal-breakfast" value="Frühstück" class="w-5 h-5 text-purple-500 rounded focus:ring-purple-500">
                                    <span class="text-ds-text">Frühstück</span>
                                    <span class="text-ds-text-muted text-sm ml-auto">Schnelle, einfache Gerichte</span>
                                </label>
                                <label class="flex items-center gap-3 p-3 border border-ds-border rounded-lg cursor-pointer hover:bg-ds-bg-muted transition-colors">
                                    <input type="checkbox" id="ai-meal-lunch" value="Mittagessen" class="w-5 h-5 text-purple-500 rounded focus:ring-purple-500">
                                    <span class="text-ds-text">Mittagessen</span>
                                    <span class="text-ds-text-muted text-sm ml-auto">Meal-Prep geeignet</span>
                                </label>
                                <label class="flex items-center gap-3 p-3 border border-ds-border rounded-lg cursor-pointer hover:bg-ds-bg-muted transition-colors">
                                    <input type="checkbox" id="ai-meal-dinner" value="Abendessen" checked class="w-5 h-5 text-purple-500 rounded focus:ring-purple-500">
                                    <span class="text-ds-text">Abendessen</span>
                                    <span class="text-ds-text-muted text-sm ml-auto">Hauptmahlzeit des Tages</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-ds-text-body mb-2">
                                Ernährungspräferenzen (optional)
                            </label>
                            <select id="ai-dietary-preference" class="ds-input">
                                <option value="">Keine Einschränkungen</option>
                                <option value="vegetarisch">Vegetarisch</option>
                                <option value="vegan">Vegan</option>
                                <option value="low-carb">Low Carb</option>
                                <option value="glutenfrei">Glutenfrei</option>
                                <option value="laktosefrei">Laktosefrei</option>
                            </select>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-sm font-medium text-ds-text-body mb-2">
                                    Kochzeit pro Mahlzeit
                                </label>
                                <select id="ai-cooking-time" class="ds-input">
                                    <option value="">Egal</option>
                                    <option value="schnell">Schnell (&lt; 30 Min)</option>
                                    <option value="mittel">Mittel (30-60 Min)</option>
                                    <option value="aufwendig">Aufwendig (&gt; 60 Min)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-ds-text-body mb-2">
                                    Budget
                                </label>
                                <select id="ai-budget" class="ds-input">
                                    <option value="">Egal</option>
                                    <option value="günstig">Günstig</option>
                                    <option value="mittel">Mittel</option>
                                    <option value="gehoben">Gehoben</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-ds-text-body mb-2">
                                Bevorzugte Küche (optional)
                            </label>
                            <select id="ai-cuisine" class="ds-input">
                                <option value="">Gemischt / Keine Präferenz</option>
                                <option value="deutsch">Deutsche Küche</option>
                                <option value="italienisch">Italienisch</option>
                                <option value="asiatisch">Asiatisch</option>
                                <option value="mediterran">Mediterran</option>
                                <option value="mexikanisch">Mexikanisch</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-ds-text-body mb-2">
                                Zutaten vermeiden (optional)
                            </label>
                            <input type="text" id="ai-avoid-ingredients"
                                   class="ds-input"
                                   placeholder="z.B. Nüsse, Sellerie, Meeresfrüchte">
                        </div>

                        <div class="bg-purple-50 p-3 rounded-lg">
                            <p class="text-sm text-purple-700">
                                <strong>Hinweis:</strong> Die KI erstellt Vorschläge für die gesamte angezeigte Woche.
                                Bestehende Mahlzeiten werden überschrieben.
                            </p>
                        </div>

                        <div class="flex gap-2 justify-end pt-2">
                            <button id="cancel-ai-generate" class="ds-btn border border-ds-border text-ds-text-body hover:bg-ds-bg-subtle transition-colors">
                                Abbrechen
                            </button>
                            <button id="confirm-ai-generate" class="ds-btn ds-btn-primary flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                                </svg>
                                Generieren
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    attachEventListeners() {
        // Seasonal recipe cards - click to open recipe detail
        document.querySelectorAll('.seasonal-recipe-card').forEach(card => {
            card.addEventListener('click', async () => {
                const recipeId = card.dataset.recipeId;
                // Switch to recipes view and open recipe detail
                AppState.currentView = 'recipes';
                App.render();
                // Wait for render then open detail
                setTimeout(async () => {
                    await App.navigateToRecipeDetail(recipeId);
                }, 100);
            });
        });

        // Week navigation buttons
        const prevWeekBtn = document.getElementById('prev-week-btn');
        if (prevWeekBtn) {
            prevWeekBtn.addEventListener('click', () => AppState.navigateWeek(-1));
        }

        const nextWeekBtn = document.getElementById('next-week-btn');
        if (nextWeekBtn) {
            nextWeekBtn.addEventListener('click', () => AppState.navigateWeek(1));
        }

        const goToCurrentWeekBtn = document.getElementById('go-to-current-week-btn');
        if (goToCurrentWeekBtn) {
            goToCurrentWeekBtn.addEventListener('click', () => AppState.goToCurrentWeek());
        }

        // Mobile day navigation
        const prevDayBtn = document.getElementById('prev-day-btn');
        if (prevDayBtn) {
            prevDayBtn.addEventListener('click', () => {
                if (this.mobileViewDay > 0) {
                    this.mobileViewDay--;
                    App.render();
                }
            });
        }

        const nextDayBtn = document.getElementById('next-day-btn');
        if (nextDayBtn) {
            nextDayBtn.addEventListener('click', () => {
                if (this.mobileViewDay < 6) {
                    this.mobileViewDay++;
                    App.render();
                }
            });
        }

        // Day selector buttons
        document.querySelectorAll('.day-selector-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.mobileViewDay = parseInt(e.currentTarget.dataset.dayIndex);
                App.render();
            });
        });

        // Setup swipe gestures for mobile day view
        const mobileDayView = document.getElementById('mobile-day-view');
        if (mobileDayView && typeof MobileUtils !== 'undefined' && MobileUtils.isTouchDevice()) {
            MobileUtils.setupSwipeGestures(mobileDayView, {
                onSwipeLeft: () => {
                    if (this.mobileViewDay < 6) {
                        this.mobileViewDay++;
                        App.render();
                    }
                },
                onSwipeRight: () => {
                    if (this.mobileViewDay > 0) {
                        this.mobileViewDay--;
                        App.render();
                    }
                }
            });
        }

        // Reset week plan
        const resetBtn = document.getElementById('reset-week-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                if (confirm('Möchtest du den Wochenplan wirklich zurücksetzen?')) {
                    // Save current week plan before resetting
                    const oldWeekPlan = JSON.parse(JSON.stringify(AppState.weekPlan));

                    // Reset week plan for current displayed week
                    await AppState.initializeWeekPlan(AppState.currentWeekStart);
                    const weekId = DateUtils.getWeekId(AppState.currentWeekStart);
                    AppState.weekPlansCache[weekId] = AppState.weekPlan;
                    App.render();

                    // Show toast with undo option
                    Toast.show('Wochenplan zurückgesetzt', {
                        showUndo: true,
                        onUndo: async () => {
                            await StorageService.saveWeekPlan(oldWeekPlan);
                            AppState.weekPlansCache[weekId] = oldWeekPlan;
                            AppState.weekPlan = oldWeekPlan;
                            App.render();
                            Toast.show('Wochenplan wiederhergestellt');
                        }
                    });
                }
            });
        }

        // Add meal buttons
        document.querySelectorAll('.add-meal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectedDay = parseInt(e.currentTarget.dataset.day);
                this.selectedMealType = e.currentTarget.dataset.meal;
                this.showRecipeSelector();
            });
        });

        // Remove meal buttons
        document.querySelectorAll('.remove-meal-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const dayIndex = parseInt(e.currentTarget.dataset.day);
                const mealType = e.currentTarget.dataset.meal;
                await this.removeMeal(dayIndex, mealType);
            });
        });

        // Mark as cooked buttons
        document.querySelectorAll('.mark-cooked-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const recipeId = e.currentTarget.dataset.recipeId;
                const recipeName = e.currentTarget.dataset.recipeName;
                await this.markRecipeAsCooked(recipeId, recipeName);
            });
        });

        // Open recipe from week plan
        document.querySelectorAll('.open-recipe-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const recipeId = e.currentTarget.dataset.recipeId;
                if (recipeId) {
                    // Switch to recipes view and open the recipe detail
                    AppState.setView('recipes');
                    // Wait for render, then open recipe detail view
                    setTimeout(() => {
                        App.navigateToRecipeDetail(recipeId);
                    }, 100);
                }
            });
        });

        // Close recipe selector
        const closeBtn = document.getElementById('close-recipe-selector');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideRecipeSelector());
        }

        // Select recipe buttons
        document.querySelectorAll('.select-recipe-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const recipeId = e.currentTarget.dataset.recipeId;
                await this.assignRecipe(recipeId);
            });
        });

        // Save template button
        const saveTemplateBtn = document.getElementById('save-template-btn');
        if (saveTemplateBtn) {
            saveTemplateBtn.addEventListener('click', () => this.showSaveTemplateModal());
        }

        // Load template button
        const loadTemplateBtn = document.getElementById('load-template-btn');
        if (loadTemplateBtn) {
            loadTemplateBtn.addEventListener('click', () => this.showLoadTemplateModal());
        }

        // Save template modal events
        const closeSaveTemplate = document.getElementById('close-save-template');
        if (closeSaveTemplate) {
            closeSaveTemplate.addEventListener('click', () => this.hideSaveTemplateModal());
        }

        const cancelSaveTemplate = document.getElementById('cancel-save-template');
        if (cancelSaveTemplate) {
            cancelSaveTemplate.addEventListener('click', () => this.hideSaveTemplateModal());
        }

        const confirmSaveTemplate = document.getElementById('confirm-save-template');
        if (confirmSaveTemplate) {
            confirmSaveTemplate.addEventListener('click', () => this.saveAsTemplate());
        }

        // Load template modal events
        const closeLoadTemplate = document.getElementById('close-load-template');
        if (closeLoadTemplate) {
            closeLoadTemplate.addEventListener('click', () => this.hideLoadTemplateModal());
        }

        // AI Generate button
        const aiGenerateBtn = document.getElementById('ai-generate-btn');
        if (aiGenerateBtn) {
            aiGenerateBtn.addEventListener('click', () => this.showAIGenerateModal());
        }

        // AI Generate modal events
        const closeAIGenerate = document.getElementById('close-ai-generate');
        if (closeAIGenerate) {
            closeAIGenerate.addEventListener('click', () => this.hideAIGenerateModal());
        }

        const cancelAIGenerate = document.getElementById('cancel-ai-generate');
        if (cancelAIGenerate) {
            cancelAIGenerate.addEventListener('click', () => this.hideAIGenerateModal());
        }

        const confirmAIGenerate = document.getElementById('confirm-ai-generate');
        if (confirmAIGenerate) {
            confirmAIGenerate.addEventListener('click', () => this.generateAIWeekPlan());
        }
    },

    _releaseFocusTrap: null,

    showRecipeSelector() {
        const modal = document.getElementById('recipe-selector-modal');
        if (modal) {
            modal.classList.add('active');
            this._releaseFocusTrap = trapFocus(modal);
        }
    },

    hideRecipeSelector() {
        if (this._releaseFocusTrap) {
            this._releaseFocusTrap();
            this._releaseFocusTrap = null;
        }
        const modal = document.getElementById('recipe-selector-modal');
        if (modal) modal.classList.remove('active');
    },

    async assignRecipe(recipeId) {
        const recipe = await StorageService.getRecipeById(recipeId);
        if (!recipe || this.selectedMealType === null) return;

        AppState.weekPlan.days[this.selectedDay].meals[this.selectedMealType] = {
            id: Date.now().toString(),
            recipeId: recipe.id,
            recipeName: recipe.name,
            mealType: this.selectedMealType
        };

        await StorageService.saveWeekPlan(AppState.weekPlan);
        // Update cache
        const weekId = DateUtils.getWeekId(AppState.currentWeekStart);
        AppState.weekPlansCache[weekId] = AppState.weekPlan;

        this.hideRecipeSelector();
        App.render();

        Toast.success('Wochenplan aktualisiert');
    },

    async removeMeal(dayIndex, mealType) {
        // Save meal data for undo
        const removedMeal = AppState.weekPlan.days[dayIndex].meals[mealType];
        const dayName = AppState.weekPlan.days[dayIndex].dayName;
        const mealName = removedMeal?.recipeName || removedMeal?.recipe_name || 'Mahlzeit';
        const weekId = DateUtils.getWeekId(AppState.currentWeekStart);

        delete AppState.weekPlan.days[dayIndex].meals[mealType];
        await StorageService.saveWeekPlan(AppState.weekPlan);
        // Update cache
        AppState.weekPlansCache[weekId] = AppState.weekPlan;
        App.render();

        // Define undo function
        const undoRemove = async () => {
            AppState.weekPlan.days[dayIndex].meals[mealType] = removedMeal;
            await StorageService.saveWeekPlan(AppState.weekPlan);
            AppState.weekPlansCache[weekId] = AppState.weekPlan;
            App.render();
            Toast.success(`"${mealName}" wiederhergestellt`);
        };

        // Add to action history for Ctrl+Z
        ActionHistory.addAction({
            undo: undoRemove,
            undoMessage: `"${mealName}" wiederhergestellt`
        });

        // Show toast with undo option
        Toast.show(`"${mealName}" aus ${dayName} entfernt`, {
            showUndo: true,
            onUndo: undoRemove
        });
    },

    async markRecipeAsCooked(recipeId, recipeName) {
        try {
            await StorageService.markAsCooked(recipeId);
            Toast.success(`"${recipeName}" als gekocht markiert`);
        } catch (error) {
            Toast.error('Fehler beim Markieren als gekocht');
            console.error(error);
        }
    },

    // Template methods
    showSaveTemplateModal() {
        const modal = document.getElementById('save-template-modal');
        if (modal) modal.classList.add('active');
    },

    hideSaveTemplateModal() {
        const modal = document.getElementById('save-template-modal');
        if (modal) modal.classList.remove('active');
        // Clear inputs
        document.getElementById('template-name-input').value = '';
        document.getElementById('template-description-input').value = '';
    },

    async saveAsTemplate() {
        const nameInput = document.getElementById('template-name-input');
        const descriptionInput = document.getElementById('template-description-input');

        const name = nameInput.value.trim();
        if (!name) {
            Toast.error('Bitte gib einen Namen für die Vorlage ein');
            return;
        }

        // Check if week plan has any meals
        const hasMeals = AppState.weekPlan.days.some(day =>
            Object.keys(day.meals || {}).length > 0
        );

        if (!hasMeals) {
            Toast.error('Der Wochenplan ist leer. Füge zuerst Rezepte hinzu.');
            return;
        }

        const template = {
            id: Date.now().toString(),
            name: name,
            description: descriptionInput.value.trim(),
            templateData: {
                days: AppState.weekPlan.days
            }
        };

        try {
            await StorageService.saveTemplate(template);
            this.hideSaveTemplateModal();
            Toast.success(`Vorlage "${name}" gespeichert ✓`);
        } catch (error) {
            Toast.error('Fehler beim Speichern der Vorlage');
            console.error(error);
        }
    },

    async showLoadTemplateModal() {
        const modal = document.getElementById('load-template-modal');
        if (modal) modal.classList.add('active');

        // Load templates
        const templates = await StorageService.getTemplates();
        const templatesList = document.getElementById('templates-list');

        if (!templates || templates.length === 0) {
            templatesList.innerHTML = `
                <p class="text-ds-text-muted text-center py-8">
                    Noch keine Vorlagen vorhanden.<br>
                    Speichere deinen aktuellen Wochenplan als Vorlage!
                </p>
            `;
            return;
        }

        templatesList.innerHTML = `
            <div class="space-y-3">
                ${templates.map(template => `
                    <div class="border border-ds-border rounded-lg p-4 hover:bg-ds-bg-muted transition-colors">
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex-1">
                                <h4 class="font-semibold text-ds-text">${escapeHtml(template.name)}</h4>
                                ${template.description ? `
                                    <p class="text-sm text-ds-text-sec mt-1">${escapeHtml(template.description)}</p>
                                ` : ''}
                                <p class="text-xs text-ds-text-muted mt-2">
                                    Erstellt: ${new Date(template.createdAt).toLocaleDateString('de-DE')}
                                </p>
                            </div>
                            <div class="flex gap-2">
                                <button class="load-template-btn ds-btn ds-btn-sm ds-btn-secondary"
                                        data-template-id="${template.id}">
                                    Laden
                                </button>
                                <button class="delete-template-btn ds-btn ds-btn-sm ds-btn-destructive"
                                        data-template-id="${template.id}">
                                    Löschen
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Attach event listeners for load and delete buttons
        document.querySelectorAll('.load-template-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const templateId = e.target.dataset.templateId;
                await this.loadFromTemplate(templateId);
            });
        });

        document.querySelectorAll('.delete-template-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const templateId = e.target.dataset.templateId;
                await this.deleteTemplate(templateId);
            });
        });
    },

    hideLoadTemplateModal() {
        const modal = document.getElementById('load-template-modal');
        if (modal) modal.classList.remove('active');
    },

    async loadFromTemplate(templateId) {
        if (!confirm('Möchtest du den aktuellen Wochenplan mit dieser Vorlage überschreiben?')) {
            return;
        }

        try {
            const template = await StorageService.getTemplateById(templateId);
            if (!template) {
                Toast.error('Vorlage nicht gefunden');
                return;
            }

            // Save current plan for undo
            const oldWeekPlan = JSON.parse(JSON.stringify(AppState.weekPlan));

            // Apply template to current week plan
            AppState.weekPlan.days = template.templateData.days;

            await StorageService.saveWeekPlan(AppState.weekPlan);
            this.hideLoadTemplateModal();
            App.render();

            Toast.show(`Vorlage "${template.name}" geladen`, {
                showUndo: true,
                onUndo: async () => {
                    await StorageService.saveWeekPlan(oldWeekPlan);
                    await AppState.reloadData();
                    App.render();
                    Toast.show('Vorlage rückgängig gemacht');
                }
            });
        } catch (error) {
            Toast.error('Fehler beim Laden der Vorlage');
            console.error(error);
        }
    },

    async deleteTemplate(templateId) {
        if (!confirm('Möchtest du diese Vorlage wirklich löschen?')) {
            return;
        }

        try {
            await StorageService.deleteTemplate(templateId);
            Toast.success('Vorlage gelöscht');
            // Refresh the modal
            await this.showLoadTemplateModal();
        } catch (error) {
            Toast.error('Fehler beim Löschen der Vorlage');
            console.error(error);
        }
    },

    // AI Generation Methods
    showAIGenerateModal() {
        this.aiError = null;
        const modal = document.getElementById('ai-generate-modal');
        if (modal) modal.classList.add('active');
    },

    hideAIGenerateModal() {
        const modal = document.getElementById('ai-generate-modal');
        if (modal) modal.classList.remove('active');
    },

    async generateAIWeekPlan() {
        // Get selected meal types
        const mealTypes = [];
        if (document.getElementById('ai-meal-breakfast')?.checked) mealTypes.push('Frühstück');
        if (document.getElementById('ai-meal-lunch')?.checked) mealTypes.push('Mittagessen');
        if (document.getElementById('ai-meal-dinner')?.checked) mealTypes.push('Abendessen');

        if (mealTypes.length === 0) {
            Toast.error('Bitte wähle mindestens eine Mahlzeit aus');
            return;
        }

        // Get all preferences
        const dietary = document.getElementById('ai-dietary-preference')?.value || '';
        const cookingTime = document.getElementById('ai-cooking-time')?.value || '';
        const budget = document.getElementById('ai-budget')?.value || '';
        const cuisines = document.getElementById('ai-cuisine')?.value || '';
        const avoidIngredients = document.getElementById('ai-avoid-ingredients')?.value || '';

        // Build preferences object
        const preferences = {};
        if (dietary) preferences.dietary = dietary;
        if (cookingTime) preferences.cookingTime = cookingTime;
        if (budget) preferences.budget = budget;
        if (cuisines) preferences.cuisines = cuisines;
        if (avoidIngredients) preferences.avoidIngredients = avoidIngredients;

        // Confirm overwrite
        const hasMeals = AppState.weekPlan.days.some(day =>
            mealTypes.some(mealType => day.meals[mealType])
        );

        if (hasMeals) {
            if (!confirm('Bestehende Mahlzeiten für die ausgewählten Typen werden überschrieben. Fortfahren?')) {
                return;
            }
        }

        // Save current plan for undo
        const oldWeekPlan = JSON.parse(JSON.stringify(AppState.weekPlan));

        // Hide modal and show loading state
        this.hideAIGenerateModal();
        this.aiGenerating = true;
        this.aiError = null;
        App.render();

        try {
            const data = await api.post(`${API_BASE_URL}/ai/generate-weekplan`, {
                    mealTypes,
                    days: 7,
                    preferences
                });

            if (!data.success || !data.weekPlan) {
                throw new Error('Ungültige Antwort vom Server');
            }

            // Map AI response to week plan structure
            const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

            AppState.weekPlan.days.forEach((day, index) => {
                const aiDay = data.weekPlan[dayNames[index]];
                if (!aiDay) return;

                mealTypes.forEach(mealType => {
                    const aiMeal = aiDay[mealType];
                    if (aiMeal && aiMeal.name) {
                        day.meals[mealType] = {
                            id: aiMeal.recipeId || `ai-${Date.now()}-${index}-${mealType}`,
                            recipeId: aiMeal.recipeId || null, // Use real recipe ID from backend
                            recipeName: aiMeal.name,
                            mealType: mealType,
                            aiGenerated: true,
                            description: aiMeal.description || '',
                            category: aiMeal.category || ''
                        };
                    }
                });
            });

            // Reload recipes to include newly created AI recipes
            AppState.recipes = await StorageService.getRecipes({ all: true });

            // Save the updated week plan
            await StorageService.saveWeekPlan(AppState.weekPlan);
            const weekId = DateUtils.getWeekId(AppState.currentWeekStart);
            AppState.weekPlansCache[weekId] = AppState.weekPlan;

            this.aiGenerating = false;
            App.render();

            // Show success with tips
            let successMessage = 'KI-Wochenplan erstellt!';
            if (data.shoppingTips && data.shoppingTips.length > 0) {
                successMessage += ` Tipp: ${data.shoppingTips[0]}`;
            }

            Toast.show(successMessage, {
                showUndo: true,
                duration: 6000,
                onUndo: async () => {
                    await StorageService.saveWeekPlan(oldWeekPlan);
                    AppState.weekPlansCache[weekId] = oldWeekPlan;
                    AppState.weekPlan = oldWeekPlan;
                    App.render();
                    Toast.show('KI-Vorschläge rückgängig gemacht');
                }
            });

        } catch (error) {
            console.error('AI generation error:', error);
            this.aiGenerating = false;
            this.aiError = error.message || 'Ein Fehler ist aufgetreten';

            // Restore old plan
            AppState.weekPlan = oldWeekPlan;
            App.render();

            // Show error modal with retry option
            this.showAIGenerateModal();
            Toast.error('Fehler bei der KI-Generierung');
        }
    }
};

// Recipe Database View
