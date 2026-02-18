import { AppState } from '../core/app-state.js';
import { StorageService } from '../core/storage-service.js';
import { Toast } from '../core/toast.js';
import { DateUtils } from '../core/date-utils.js';
import { escapeHtml } from '../core/utils.js';
import { App } from '../app.js';

export const MealPrepView = {
    isSaving: false,
    selectedRecipeId: null,
    aiLoading: false,
    aiError: null,
    lastAiPayload: null,
    isRecipeModalOpen: false,

    getMealPrepItems() {
        return AppState.weekPlan?.mealPrepPlan?.items || {};
    },

    getMealPrepArray() {
        const items = this.getMealPrepItems();
        return Object.values(items).sort((a, b) => {
            const nameA = (a.recipeName || '').toLowerCase();
            const nameB = (b.recipeName || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
    },

    renderPrepDatePicker() {
        const prepDate = AppState.weekPlan?.mealPrepPlan?.prepDate || '';
        const prepDateValue = prepDate ? prepDate.substring(0, 10) : '';
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-4 transition-colors duration-200">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800 dark:text-white">Geplanter Meal-Prep Tag</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Wähle den Tag, an dem du batch-kochen möchtest.</p>
                    </div>
                    <input type="date" id="meal-prep-date" value="${escapeHtml(prepDateValue)}"
                        class="px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
            </div>
        `;
    },

    renderRecipeSelector() {
        const mealPrepItems = this.getMealPrepItems();
        const eligibleRecipes = AppState.recipes
            .filter((recipe) => recipe.is_meal_prep_suitable)
            .map((recipe) => ({
                ...recipe,
                alreadySelected: Boolean(mealPrepItems[recipe.id])
            }));

        if (eligibleRecipes.length === 0) {
            return `
                <div class="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <h3 class="font-medium text-yellow-800 dark:text-yellow-200">Keine Meal-Prep geeigneten Rezepte gefunden</h3>
                    <p class="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                        Markiere Rezepte in der Rezeptdatenbank als "Meal-Prep geeignet", um sie hier zu sehen.
                    </p>
                </div>
            `;
        }

        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-4 transition-colors duration-200">
                <div class="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800 dark:text-white">Meal-Prep Rezepte</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Füge Rezepte hinzu, die du in deiner Meal-Prep Session kochen möchtest.</p>
                    </div>
                    <button id="add-meal-prep-recipe-btn" class="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-700 transition-colors flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                        Rezept hinzufügen
                    </button>
                </div>
                <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    ${this.getMealPrepArray().map((item) => this.renderMealPrepCard(item)).join('') || this.renderEmptyState()}
                </div>
            </div>

            <div id="meal-prep-recipe-modal" class="modal ${this.isRecipeModalOpen ? 'active' : ''}">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
                    <div class="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
                        <h3 class="text-lg font-semibold text-gray-800 dark:text-white">Meal-Prep Rezept hinzufügen</h3>
                        <button class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl" id="close-meal-prep-modal">✕</button>
                    </div>
                    <div class="p-4 overflow-y-auto max-h-[70vh]">
                        <div class="grid gap-3">
                            ${eligibleRecipes.map((recipe) => this.renderRecipeSelectRow(recipe)).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderRecipeSelectRow(recipe) {
        const isSelected = this.getMealPrepItems()[recipe.id];
        const recipeIdSafe = escapeHtml(String(recipe.id));
        const recipeNameSafe = escapeHtml(recipe.name || '');
        const categorySafe = escapeHtml(recipe.category || '');
        const mealTypesValue = escapeHtml((isSelected?.mealTypes || []).join(', '));
        const targetDatesValue = escapeHtml((isSelected?.targetDates || []).join(', '));
        const notesValue = escapeHtml(isSelected?.notes || '');

        return `
            <div class="p-3 rounded-lg border dark:border-gray-700 ${isSelected ? 'bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-700' : 'bg-white dark:bg-gray-800'}">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div class="flex-1">
                        <h4 class="font-medium text-gray-800 dark:text-white">${recipeNameSafe}</h4>
                        <div class="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-2 mt-1">
                            ${recipe.category ? `<span class="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">${categorySafe}</span>` : ''}
                            ${recipe.servings ? `<span>${recipe.servings} Portionen</span>` : ''}
                            ${recipe.prep_time || recipe.cook_time ? `<span>${(recipe.prep_time || 0) + (recipe.cook_time || 0)} Min.</span>` : ''}
                            ${recipe.meal_prep_fridge_days ? `<span>🧊 ${recipe.meal_prep_fridge_days} Tage Kühlung</span>` : ''}
                            ${recipe.meal_prep_freezer_days ? `<span>❄️ ${recipe.meal_prep_freezer_days} Tage Froster</span>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button class="px-3 py-2 text-sm rounded-lg border dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition" data-action="preview" data-recipe-id="${recipeIdSafe}">
                            Details
                        </button>
                        <button class="px-3 py-2 text-sm rounded-lg ${isSelected ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50' : 'bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700'} transition" data-action="toggle" data-recipe-id="${recipeIdSafe}">
                            ${isSelected ? 'Entfernen' : 'Hinzufügen'}
                        </button>
                    </div>
                </div>
                ${isSelected ? `
                    <div class="mt-3 grid gap-2 sm:grid-cols-2">
                        <label class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                            Geplante Portionen
                            <input type="number" min="1" data-field="targetPortions" data-recipe-id="${recipeIdSafe}" value="${isSelected.targetPortions || recipe.servings || ''}"
                                class="mt-1 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                        </label>
                        <label class="flex flex-col text-sm text-gray-600 dark:text-gray-300">
                            Mahlzeiten-Typen
                            <input type="text" placeholder="z.B. Mittagessen"
                                data-field="mealTypes" data-recipe-id="${recipeIdSafe}" value="${mealTypesValue}"
                                class="mt-1 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                        </label>
                        <label class="flex flex-col text-sm text-gray-600 dark:text-gray-300 sm:col-span-2">
                            Verbrauchstage (kommagetrennt YYYY-MM-DD)
                            <input type="text" data-field="targetDates" data-recipe-id="${recipeIdSafe}" value="${targetDatesValue}"
                                class="mt-1 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                        </label>
                        <label class="flex flex-col text-sm text-gray-600 dark:text-gray-300 sm:col-span-2">
                            Zusätzliche Notizen
                            <textarea data-field="notes" data-recipe-id="${recipeIdSafe}" rows="2"
                                class="mt-1 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">${notesValue}</textarea>
                        </label>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderMealPrepCard(item) {
        const recipeNameSafe = escapeHtml(item.recipeName || 'Rezept');
        const mealTypes = (item.mealTypes || []).map((m) => `<span class="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">${escapeHtml(m)}</span>`).join('');
        const targetDates = (item.targetDates || []).map((date) => escapeHtml(date));
        const extraDates = targetDates.slice(2);
        const reheatSafe = escapeHtml(item.reheatTips || '');
        const notesSafe = escapeHtml(item.notes || '');

        return `
            <div class="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/30">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h4 class="text-lg font-semibold text-gray-800 dark:text-white">${recipeNameSafe}</h4>
                        <div class="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400 mt-2">
                            ${item.totalPortions ? `<span class="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">🍽️ ${item.totalPortions} Portionen</span>` : ''}
                            ${mealTypes}
                            ${targetDates.slice(0, 2).map((date) => `<span class="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">📆 ${date}</span>`).join('')}
                        </div>
                    </div>
                    <button class="remove-meal-prep-item text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" data-recipe-id="${escapeHtml(String(item.recipeId))}">✕</button>
                </div>

                <dl class="mt-3 grid gap-2 text-sm text-gray-600 dark:text-gray-300">
                    ${item.fridgeDays ? `<div><dt class="font-medium inline">Kühlung:</dt> <dd class="inline">${item.fridgeDays} Tage</dd></div>` : ''}
                    ${item.freezerDays ? `<div><dt class="font-medium inline">Gefrieren:</dt> <dd class="inline">${item.freezerDays} Tage</dd></div>` : ''}
                    ${item.reheatTips ? `<div><dt class="font-medium inline">Aufwärmen:</dt> <dd class="inline">${reheatSafe}</dd></div>` : ''}
                    ${item.notes ? `<div><dt class="font-medium inline">Notizen:</dt> <dd class="inline">${notesSafe}</dd></div>` : ''}
                </dl>

                ${extraDates.length ? `
                    <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Weitere Verbrauchstage: ${extraDates.join(', ')}</p>
                ` : ''}
            </div>
        `;
    },

    renderEmptyState() {
        return `
            <div class="col-span-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400">
                <p class="font-medium">Noch keine Meal-Prep Rezepte ausgewählt.</p>
                <p class="text-sm mt-1">Füge oben Rezepte hinzu, um deine Meal-Prep Session zu planen.</p>
            </div>
        `;
    },

    renderAiSuggestions() {
        const aiData = AppState.weekPlan?.mealPrepPlan?.aiSuggestions;

        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-4 transition-colors duration-200">
                <div class="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                            <span>KI Meal-Prep Hilfe</span>
                            ${this.aiLoading ? '<span class="text-xs text-purple-500">Lädt...</span>' : ''}
                        </h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                            Lass dir Sessions, Zeitplan und Einkaufshinweise für deine Meal-Prep Rezepte generieren.
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button id="refresh-meal-prep-ai" class="px-4 py-2 bg-purple-500 dark:bg-purple-600 text-white rounded-lg hover:bg-purple-600 dark:hover:bg-purple-700 transition-colors flex items-center gap-2" ${this.aiLoading ? 'disabled' : ''}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                            Vorschläge aktualisieren
                        </button>
                        <button id="clear-meal-prep-ai" class="px-3 py-2 border dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" ${!aiData ? 'disabled' : ''}>
                            Zurücksetzen
                        </button>
                    </div>
                </div>

                ${this.aiError ? `
                    <div class="mt-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                        <p class="text-sm text-red-700 dark:text-red-300">${escapeHtml(this.aiError)}</p>
                    </div>
                ` : ''}

                ${aiData ? this.renderAiContent(aiData) : `
                    <div class="mt-4 p-4 border-2 border-dashed border-purple-200 dark:border-purple-800 rounded-lg text-center text-purple-600 dark:text-purple-300">
                        <p class="font-medium">Noch keine Vorschläge</p>
                        <p class="text-sm mt-1">Sobald du Rezepte ausgewählt hast, klicke auf "Vorschläge aktualisieren".</p>
                    </div>
                `}
            </div>
        `;
    },

    renderAiContent(aiData) {
        const sessions = aiData.sessions || [];
        const shoppingGroups = aiData.shoppingGroups || [];
        const advice = aiData.generalAdvice || [];

        return `
            <div class="mt-6 space-y-6">
                ${sessions.length ? `
                    <section>
                        <h4 class="text-md font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                            <span>Meal-Prep Sessions</span>
                            <span class="text-xs text-gray-500 dark:text-gray-400">${sessions.length} Vorschläge</span>
                        </h4>
                        <div class="mt-3 grid gap-4">
                            ${sessions.map((session) => this.renderSession(session)).join('')}
                        </div>
                    </section>
                ` : ''}

                ${shoppingGroups.length ? `
                    <section>
                        <h4 class="text-md font-semibold text-gray-800 dark:text-white">Einkauf & Mise en Place</h4>
                        <div class="mt-3 grid gap-3">
                            ${shoppingGroups.map((group) => this.renderShoppingGroup(group)).join('')}
                        </div>
                    </section>
                ` : ''}

                ${advice.length ? `
                    <section>
                        <h4 class="text-md font-semibold text-gray-800 dark:text-white">Allgemeine Tipps</h4>
                        <ul class="mt-2 space-y-1 list-disc list-inside text-gray-600 dark:text-gray-300">
                            ${advice.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}
                        </ul>
                    </section>
                ` : ''}
            </div>
        `;
    },

    renderSession(session) {
        const timeline = session.timeline || [];
        const recipes = session.recipes || [];
        const labelSafe = escapeHtml(session.label || 'Meal-Prep Session');
        const startSafe = escapeHtml(session.recommendedStartTime || '');

        return `
            <div class="border dark:border-gray-700 rounded-lg p-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h5 class="text-lg font-semibold text-gray-800 dark:text-white">${labelSafe}</h5>
                        <p class="text-sm text-gray-500 dark:text-gray-400 flex gap-3 mt-1">
                            ${session.recommendedStartTime ? `<span>⏰ Start: ${startSafe}</span>` : ''}
                            ${session.estimatedTotalMinutes ? `<span>🕒 Dauer: ${session.estimatedTotalMinutes} Min.</span>` : ''}
                        </p>
                    </div>
                </div>

                ${recipes.length ? `
                    <div class="mt-4">
                        <h6 class="text-sm font-medium text-gray-700 dark:text-gray-300">Rezepte in dieser Session</h6>
                        <div class="mt-2 grid gap-2">
                            ${recipes.map((recipe) => this.renderSessionRecipe(recipe)).join('')}
                        </div>
                    </div>
                ` : ''}

                ${timeline.length ? `
                    <div class="mt-4">
                        <h6 class="text-sm font-medium text-gray-700 dark:text-gray-300">Zeitplan</h6>
                        <ul class="mt-2 space-y-2">
                            ${timeline.map((step) => `
                                <li class="flex gap-3 text-sm text-gray-600 dark:text-gray-300">
                                    <span class="font-medium text-gray-800 dark:text-white">${escapeHtml(step.start || '')} - ${escapeHtml(step.end || '')}</span>
                                    <span>${escapeHtml(step.task || '')}</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderSessionRecipe(recipe) {
        const storage = recipe.storage || {};
        const nameSafe = escapeHtml(recipe.name || 'Rezept');
        const parallelSafe = escapeHtml(recipe.parallelizationTips || '');
        const notesSafe = escapeHtml(storage.notes || '');
        const reheatSafe = escapeHtml(recipe.reheatTips || '');
        const targetDates = (recipe.targetDates || []).map((date) => escapeHtml(date)).join(', ');

        return `
            <div class="border border-dashed dark:border-gray-600 rounded-lg p-3 text-sm">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <p class="font-medium text-gray-800 dark:text-white">${nameSafe}</p>
                        <div class="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                            ${recipe.batchPortions ? `<span>🍽️ ${recipe.batchPortions} Portionen</span>` : ''}
                            ${recipe.prepOrder ? `<span>#${recipe.prepOrder} in der Reihenfolge</span>` : ''}
                            ${recipe.parallelizationTips ? `<span>⚙️ ${parallelSafe}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="mt-2 grid gap-2 text-xs text-gray-500 dark:text-gray-400">
                    ${storage.fridgeDays ? `<p>🧊 Kühlschrank: ${storage.fridgeDays} Tage${storage.notes ? ` (${notesSafe})` : ''}</p>` : ''}
                    ${storage.freezerDays ? `<p>❄️ Gefrierschrank: ${storage.freezerDays} Tage</p>` : ''}
                    ${recipe.reheatTips ? `<p>🔥 Aufwärmen: ${reheatSafe}</p>` : ''}
                    ${(recipe.targetDates || []).length ? `<p>📆 Verbrauch: ${targetDates}</p>` : ''}
                </div>
            </div>
        `;
    },

    renderShoppingGroup(group) {
        const ingredients = group.ingredients || [];
        const labelSafe = escapeHtml(group.label || 'Vorbereitungsschritt');

        return `
            <div class="border dark:border-gray-700 rounded-lg p-3">
                <h6 class="font-medium text-gray-800 dark:text-white">${labelSafe}</h6>
                <ul class="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                    ${ingredients.map((ingredient) => `
                        <li>
                            ${ingredient.totalAmount ? `<strong>${escapeHtml(String(ingredient.totalAmount))}</strong>` : ''}
                            ${escapeHtml(ingredient.unit || '')} ${escapeHtml(ingredient.name || '')}
                            ${ingredient.recipes && ingredient.recipes.length ? `<span class="text-xs text-gray-400 dark:text-gray-500">(${escapeHtml(ingredient.recipes.join(', '))})</span>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    },

    render() {
        if (!AppState.weekPlan) {
            return '<div class="text-gray-800 dark:text-gray-200">Lade Meal-Prep Daten...</div>';
        }

        return `
            <div class="space-y-4 sm:space-y-6">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 class="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Meal-Prep Planung</h2>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Plane deine Batch-Cooking Sessions, halte Haltbarkeit im Blick und lass dir von der KI helfen.</p>
                    </div>
                    <button id="save-meal-prep-plan" class="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-700 transition-colors flex items-center gap-2" ${this.isSaving ? 'disabled' : ''}>
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                        ${this.isSaving ? 'Speichert...' : 'Plan speichern'}
                    </button>
                </div>

                <div class="grid gap-4">
                    ${this.renderPrepDatePicker()}
                    ${this.renderRecipeSelector()}
                    ${this.renderAiSuggestions()}
                </div>
            </div>
        `;
    },

    attachEventListeners() {
        document.getElementById('save-meal-prep-plan')?.addEventListener('click', () => this.handleSave());

        const dateInput = document.getElementById('meal-prep-date');
        if (dateInput) {
            dateInput.addEventListener('change', (event) => {
                this.updatePrepDate(event.target.value);
            });
        }

        document.getElementById('add-meal-prep-recipe-btn')?.addEventListener('click', () => {
            this.isRecipeModalOpen = true;
            App.render();
        });

        document.getElementById('close-meal-prep-modal')?.addEventListener('click', () => {
            this.isRecipeModalOpen = false;
            App.render();
        });

        const modalOverlay = document.querySelector('#meal-prep-recipe-modal.modal');
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (event) => {
                if (event.target.id === 'meal-prep-recipe-modal') {
                    this.isRecipeModalOpen = false;
                    App.render();
                }
            });
        }

        document.querySelectorAll('#meal-prep-recipe-modal [data-action="toggle"]').forEach((button) => {
            button.addEventListener('click', (event) => this.toggleRecipeSelection(event));
        });

        document.querySelectorAll('#meal-prep-recipe-modal [data-action="preview"]').forEach((button) => {
            button.addEventListener('click', async (event) => {
                event.preventDefault();
                const recipeId = event.currentTarget.dataset.recipeId;
                this.isRecipeModalOpen = false;
                AppState.setView('recipes');
                setTimeout(async () => {
                    await RecipeDatabaseView.viewRecipe(recipeId);
                }, 100);
            });
        });

        document.querySelectorAll('#meal-prep-recipe-modal [data-field]').forEach((input) => {
            input.addEventListener('change', (event) => this.handleFieldChange(event));
            input.addEventListener('keyup', (event) => this.handleFieldChange(event));
        });

        document.querySelectorAll('.remove-meal-prep-item').forEach((button) => {
            button.addEventListener('click', (event) => {
                const recipeId = event.currentTarget.dataset.recipeId;
                this.removeRecipe(recipeId);
            });
        });

        document.getElementById('refresh-meal-prep-ai')?.addEventListener('click', () => this.generateAiSuggestions());
        document.getElementById('clear-meal-prep-ai')?.addEventListener('click', () => this.clearAiSuggestions());
    },

    updatePrepDate(value) {
        const dateValue = value ? new Date(value + 'T00:00:00').toISOString().split('T')[0] : null;
        AppState.ensureMealPrepPlanStructure(AppState.weekPlan);
        AppState.weekPlan.mealPrepPlan.prepDate = dateValue;
        AppState.schedulePersistWeekPlan();
    },

    toggleRecipeSelection(event) {
        const recipeId = event.currentTarget.dataset.recipeId;
        const items = this.getMealPrepItems();

        if (items[recipeId]) {
            delete items[recipeId];
        } else {
            const recipe = AppState.recipes.find((r) => String(r.id) === String(recipeId));
            if (!recipe) return;
            items[recipeId] = this.createMealPrepItemFromRecipe(recipe);
        }

        AppState.ensureMealPrepPlanStructure(AppState.weekPlan);
        AppState.weekPlan.mealPrepPlan.items = { ...items };
        AppState.schedulePersistWeekPlan();
        App.render();
    },

    createMealPrepItemFromRecipe(recipe) {
        return {
            recipeId: String(recipe.id),
            recipeName: recipe.name,
            totalPortions: recipe.servings || null,
            fridgeDays: recipe.meal_prep_fridge_days || null,
            freezerDays: recipe.meal_prep_freezer_days || null,
            reheatTips: recipe.meal_prep_reheat_tips || '',
            notes: recipe.meal_prep_batch_notes || '',
            targetDates: [],
            mealTypes: [],
            targetPortions: recipe.servings || null
        };
    },

    handleFieldChange(event) {
        const field = event.target.dataset.field;
        const recipeId = event.target.dataset.recipeId;
        if (!field || !recipeId) return;

        const items = this.getMealPrepItems();
        const item = items[recipeId];
        if (!item) return;

        if (field === 'targetPortions') {
            const parsed = parseInt(event.target.value, 10);
            item.targetPortions = Number.isNaN(parsed) ? null : parsed;
            item.totalPortions = item.targetPortions;
        } else if (field === 'mealTypes') {
            item.mealTypes = event.target.value.split(',').map((value) => value.trim()).filter(Boolean);
        } else if (field === 'targetDates') {
            item.targetDates = event.target.value.split(',').map((value) => value.trim()).filter(Boolean);
        } else if (field === 'notes') {
            item.notes = event.target.value.trim();
        }

        AppState.ensureMealPrepPlanStructure(AppState.weekPlan);
        AppState.weekPlan.mealPrepPlan.items = { ...items };
        AppState.schedulePersistWeekPlan();
    },

    removeRecipe(recipeId) {
        const items = this.getMealPrepItems();
        const removed = items[recipeId];
        if (!removed) return;

        delete items[recipeId];
        AppState.weekPlan.mealPrepPlan.items = { ...items };
        AppState.schedulePersistWeekPlan();
        App.render();

        Toast.show(`Rezept "${removed.recipeName}" aus Meal-Prep entfernt`, {
            showUndo: true,
            onUndo: () => {
                AppState.weekPlan.mealPrepPlan.items[recipeId] = removed;
                App.render();
                AppState.schedulePersistWeekPlan();
            }
        });
    },

    async handleSave() {
        this.isSaving = true;
        App.render();
        try {
            await AppState.persistWeekPlan();
            Toast.success('Meal-Prep Plan gespeichert ✓');
        } catch (error) {
            console.error('Failed to save meal prep plan:', error);
            Toast.error('Meal-Prep Plan konnte nicht gespeichert werden');
        } finally {
            this.isSaving = false;
            App.render();
        }
    },

    buildAiPayload() {
        const items = this.getMealPrepItems();
        const recipes = Object.values(items).map((item) => {
            const recipe = AppState.recipes.find((r) => String(r.id) === String(item.recipeId)) || {};
            return {
                id: item.recipeId,
                name: item.recipeName,
                category: recipe.category || null,
                servings: recipe.servings || null,
                prep_time: recipe.prep_time || null,
                cook_time: recipe.cook_time || null,
                difficulty: recipe.difficulty || null,
                is_meal_prep_suitable: true,
                meal_prep_fridge_days: recipe.meal_prep_fridge_days || null,
                meal_prep_freezer_days: recipe.meal_prep_freezer_days || null,
                meal_prep_reheat_tips: recipe.meal_prep_reheat_tips || '',
                meal_prep_batch_notes: recipe.meal_prep_batch_notes || '',
                targetPortions: item.targetPortions || recipe.servings || null,
                targetDates: item.targetDates || [],
                mealTypes: item.mealTypes || []
            };
        });

        return {
            prepDay: AppState.weekPlan?.mealPrepPlan?.prepDate || null,
            recipes
        };
    },

    async generateAiSuggestions() {
        const payload = this.buildAiPayload();
        if (!payload.recipes.length) {
            Toast.error('Füge mindestens ein Meal-Prep Rezept hinzu');
            return;
        }

        this.aiLoading = true;
        this.aiError = null;
        this.lastAiPayload = payload;
        App.render();

        try {
            const result = await StorageService.generateMealPrepSuggestions(payload);
            AppState.ensureMealPrepPlanStructure(AppState.weekPlan);
            AppState.weekPlan.mealPrepPlan.aiSuggestions = result;
            AppState.schedulePersistWeekPlan(0);
            Toast.success('Meal-Prep Vorschläge aktualisiert');
        } catch (error) {
            this.aiError = error.message || 'Meal-Prep Vorschläge konnten nicht erzeugt werden';
        } finally {
            this.aiLoading = false;
            App.render();
        }
    },

    clearAiSuggestions() {
        AppState.ensureMealPrepPlanStructure(AppState.weekPlan);
        AppState.weekPlan.mealPrepPlan.aiSuggestions = null;
        AppState.schedulePersistWeekPlan();
        App.render();
    }
};

// AI Recipe Generator View
