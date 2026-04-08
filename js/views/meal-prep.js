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
            <div class="ds-card p-4 transition-colors duration-200">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h3 class="ds-section-title">Geplanter Meal-Prep Tag</h3>
                        <p class="text-sm text-ds-text-muted">Wähle den Tag, an dem du batch-kochen möchtest.</p>
                    </div>
                    <input type="date" id="meal-prep-date" value="${escapeHtml(prepDateValue)}"
                        class="ds-input px-3 py-2" />
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
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 class="font-medium text-yellow-800">Keine Meal-Prep geeigneten Rezepte gefunden</h3>
                    <p class="mt-1 text-sm text-yellow-700">
                        Markiere Rezepte in der Rezeptdatenbank als "Meal-Prep geeignet", um sie hier zu sehen.
                    </p>
                </div>
            `;
        }

        return `
            <div class="ds-card p-4 transition-colors duration-200">
                <div class="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h3 class="ds-section-title">Meal-Prep Rezepte</h3>
                        <p class="text-sm text-ds-text-muted">Füge Rezepte hinzu, die du in deiner Meal-Prep Session kochen möchtest.</p>
                    </div>
                    <button id="add-meal-prep-recipe-btn" class="ds-btn ds-btn-primary flex items-center gap-2">
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
                <div class="ds-card shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
                    <div class="flex items-center justify-between px-4 py-3 border-b border-ds-border">
                        <h3 class="ds-section-title">Meal-Prep Rezept hinzufügen</h3>
                        <button class="text-ds-text-muted hover:text-ds-text-body text-2xl" id="close-meal-prep-modal">✕</button>
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
            <div class="p-3 rounded-lg border border-ds-border ${isSelected ? 'bg-green-50 border-green-200' : 'bg-ds-bg'}">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div class="flex-1">
                        <h4 class="font-medium text-ds-text">${recipeNameSafe}</h4>
                        <div class="text-xs text-ds-text-muted flex flex-wrap gap-2 mt-1">
                            ${recipe.category ? `<span class="ds-badge ds-badge-accent">${categorySafe}</span>` : ''}
                            ${recipe.servings ? `<span>${recipe.servings} Portionen</span>` : ''}
                            ${recipe.prep_time || recipe.cook_time ? `<span>${(recipe.prep_time || 0) + (recipe.cook_time || 0)} Min.</span>` : ''}
                            ${recipe.meal_prep_fridge_days ? `<span>🧊 ${recipe.meal_prep_fridge_days} Tage Kühlung</span>` : ''}
                            ${recipe.meal_prep_freezer_days ? `<span>❄️ ${recipe.meal_prep_freezer_days} Tage Froster</span>` : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button class="ds-btn ds-btn-secondary ds-btn-sm" data-action="preview" data-recipe-id="${recipeIdSafe}">
                            Details
                        </button>
                        <button class="${isSelected ? 'ds-btn ds-btn-destructive ds-btn-sm' : 'ds-btn ds-btn-primary ds-btn-sm'}" data-action="toggle" data-recipe-id="${recipeIdSafe}">
                            ${isSelected ? 'Entfernen' : 'Hinzufügen'}
                        </button>
                    </div>
                </div>
                ${isSelected ? `
                    <div class="mt-3 grid gap-2 sm:grid-cols-2">
                        <label class="flex flex-col text-sm text-ds-text-body">
                            Geplante Portionen
                            <input type="number" min="1" data-field="targetPortions" data-recipe-id="${recipeIdSafe}" value="${isSelected.targetPortions || recipe.servings || ''}"
                                class="ds-input mt-1 px-2 py-1" />
                        </label>
                        <label class="flex flex-col text-sm text-ds-text-body">
                            Mahlzeiten-Typen
                            <input type="text" placeholder="z.B. Mittagessen"
                                data-field="mealTypes" data-recipe-id="${recipeIdSafe}" value="${mealTypesValue}"
                                class="ds-input mt-1 px-2 py-1" />
                        </label>
                        <label class="flex flex-col text-sm text-ds-text-body sm:col-span-2">
                            Verbrauchstage (kommagetrennt YYYY-MM-DD)
                            <input type="text" data-field="targetDates" data-recipe-id="${recipeIdSafe}" value="${targetDatesValue}"
                                class="ds-input mt-1 px-2 py-1" />
                        </label>
                        <label class="flex flex-col text-sm text-ds-text-body sm:col-span-2">
                            Zusätzliche Notizen
                            <textarea data-field="notes" data-recipe-id="${recipeIdSafe}" rows="2"
                                class="ds-input mt-1 px-2 py-1">${notesValue}</textarea>
                        </label>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderMealPrepCard(item) {
        const recipeNameSafe = escapeHtml(item.recipeName || 'Rezept');
        const mealTypes = (item.mealTypes || []).map((m) => `<span class="ds-badge ds-badge-accent">${escapeHtml(m)}</span>`).join('');
        const targetDates = (item.targetDates || []).map((date) => escapeHtml(date));
        const extraDates = targetDates.slice(2);
        const reheatSafe = escapeHtml(item.reheatTips || '');
        const notesSafe = escapeHtml(item.notes || '');

        return `
            <div class="border border-ds-border rounded-lg p-4 bg-ds-bg-muted">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <h4 class="text-lg font-semibold text-ds-text">${recipeNameSafe}</h4>
                        <div class="flex flex-wrap gap-2 text-xs text-ds-text-muted mt-2">
                            ${item.totalPortions ? `<span class="ds-badge ds-badge-accent">🍽️ ${item.totalPortions} Portionen</span>` : ''}
                            ${mealTypes}
                            ${targetDates.slice(0, 2).map((date) => `<span class="ds-badge ds-badge-accent">📆 ${date}</span>`).join('')}
                        </div>
                    </div>
                    <button class="remove-meal-prep-item text-red-500 hover:text-red-700" data-recipe-id="${escapeHtml(String(item.recipeId))}">✕</button>
                </div>

                <dl class="mt-3 grid gap-2 text-sm text-ds-text-body">
                    ${item.fridgeDays ? `<div><dt class="font-medium inline">Kühlung:</dt> <dd class="inline">${item.fridgeDays} Tage</dd></div>` : ''}
                    ${item.freezerDays ? `<div><dt class="font-medium inline">Gefrieren:</dt> <dd class="inline">${item.freezerDays} Tage</dd></div>` : ''}
                    ${item.reheatTips ? `<div><dt class="font-medium inline">Aufwärmen:</dt> <dd class="inline">${reheatSafe}</dd></div>` : ''}
                    ${item.notes ? `<div><dt class="font-medium inline">Notizen:</dt> <dd class="inline">${notesSafe}</dd></div>` : ''}
                </dl>

                ${extraDates.length ? `
                    <p class="mt-2 text-xs text-ds-text-muted">Weitere Verbrauchstage: ${extraDates.join(', ')}</p>
                ` : ''}
            </div>
        `;
    },

    renderEmptyState() {
        return `
            <div class="col-span-full border-2 border-dashed border-ds-border rounded-lg p-8 text-center text-ds-text-muted">
                <p class="font-medium">Noch keine Meal-Prep Rezepte ausgewählt.</p>
                <p class="text-sm mt-1">Füge oben Rezepte hinzu, um deine Meal-Prep Session zu planen.</p>
            </div>
        `;
    },

    renderAiSuggestions() {
        const aiData = AppState.weekPlan?.mealPrepPlan?.aiSuggestions;

        return `
            <div class="ds-card p-4 transition-colors duration-200">
                <div class="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h3 class="ds-section-title flex items-center gap-2">
                            <span>KI Meal-Prep Hilfe</span>
                            ${this.aiLoading ? '<span class="text-xs text-purple-500">Lädt...</span>' : ''}
                        </h3>
                        <p class="text-sm text-ds-text-muted">
                            Lass dir Sessions, Zeitplan und Einkaufshinweise für deine Meal-Prep Rezepte generieren.
                        </p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button id="refresh-meal-prep-ai" class="ds-btn ds-btn-primary flex items-center gap-2" ${this.aiLoading ? 'disabled' : ''}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                            Vorschläge aktualisieren
                        </button>
                        <button id="clear-meal-prep-ai" class="ds-btn ds-btn-secondary" ${!aiData ? 'disabled' : ''}>
                            Zurücksetzen
                        </button>
                    </div>
                </div>

                ${this.aiError ? `
                    <div class="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p class="text-sm text-red-700">${escapeHtml(this.aiError)}</p>
                    </div>
                ` : ''}

                ${aiData ? this.renderAiContent(aiData) : `
                    <div class="mt-4 p-4 border-2 border-dashed border-purple-200 rounded-lg text-center text-purple-600">
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
                        <h4 class="text-md font-semibold text-ds-text flex items-center gap-2">
                            <span>Meal-Prep Sessions</span>
                            <span class="text-xs text-ds-text-muted">${sessions.length} Vorschläge</span>
                        </h4>
                        <div class="mt-3 grid gap-4">
                            ${sessions.map((session) => this.renderSession(session)).join('')}
                        </div>
                    </section>
                ` : ''}

                ${shoppingGroups.length ? `
                    <section>
                        <h4 class="text-md font-semibold text-ds-text">Einkauf & Mise en Place</h4>
                        <div class="mt-3 grid gap-3">
                            ${shoppingGroups.map((group) => this.renderShoppingGroup(group)).join('')}
                        </div>
                    </section>
                ` : ''}

                ${advice.length ? `
                    <section>
                        <h4 class="text-md font-semibold text-ds-text">Allgemeine Tipps</h4>
                        <ul class="mt-2 space-y-1 list-disc list-inside text-ds-text-body">
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
            <div class="border border-ds-border rounded-lg p-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h5 class="text-lg font-semibold text-ds-text">${labelSafe}</h5>
                        <p class="text-sm text-ds-text-muted flex gap-3 mt-1">
                            ${session.recommendedStartTime ? `<span>⏰ Start: ${startSafe}</span>` : ''}
                            ${session.estimatedTotalMinutes ? `<span>🕒 Dauer: ${session.estimatedTotalMinutes} Min.</span>` : ''}
                        </p>
                    </div>
                </div>

                ${recipes.length ? `
                    <div class="mt-4">
                        <h6 class="text-sm font-medium text-ds-text-body">Rezepte in dieser Session</h6>
                        <div class="mt-2 grid gap-2">
                            ${recipes.map((recipe) => this.renderSessionRecipe(recipe)).join('')}
                        </div>
                    </div>
                ` : ''}

                ${timeline.length ? `
                    <div class="mt-4">
                        <h6 class="text-sm font-medium text-ds-text-body">Zeitplan</h6>
                        <ul class="mt-2 space-y-2">
                            ${timeline.map((step) => `
                                <li class="flex gap-3 text-sm text-ds-text-body">
                                    <span class="font-medium text-ds-text">${escapeHtml(step.start || '')} - ${escapeHtml(step.end || '')}</span>
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
            <div class="border border-dashed border-ds-border rounded-lg p-3 text-sm">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <p class="font-medium text-ds-text">${nameSafe}</p>
                        <div class="flex flex-wrap gap-2 text-xs text-ds-text-muted mt-1">
                            ${recipe.batchPortions ? `<span>🍽️ ${recipe.batchPortions} Portionen</span>` : ''}
                            ${recipe.prepOrder ? `<span>#${recipe.prepOrder} in der Reihenfolge</span>` : ''}
                            ${recipe.parallelizationTips ? `<span>⚙️ ${parallelSafe}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="mt-2 grid gap-2 text-xs text-ds-text-muted">
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
            <div class="border border-ds-border rounded-lg p-3">
                <h6 class="font-medium text-ds-text">${labelSafe}</h6>
                <ul class="mt-2 space-y-1 text-sm text-ds-text-body">
                    ${ingredients.map((ingredient) => `
                        <li>
                            ${ingredient.totalAmount ? `<strong>${escapeHtml(String(ingredient.totalAmount))}</strong>` : ''}
                            ${escapeHtml(ingredient.unit || '')} ${escapeHtml(ingredient.name || '')}
                            ${ingredient.recipes && ingredient.recipes.length ? `<span class="text-xs text-ds-text-muted">(${escapeHtml(ingredient.recipes.join(', '))})</span>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    },

    render() {
        if (!AppState.weekPlan) {
            return '<div class="text-ds-text">Lade Meal-Prep Daten...</div>';
        }

        return `
            <div class="space-y-4 sm:space-y-6">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 class="ds-page-title">Meal-Prep Planung</h2>
                        <p class="text-sm text-ds-text-muted">Plane deine Batch-Cooking Sessions, halte Haltbarkeit im Blick und lass dir von der KI helfen.</p>
                    </div>
                    <button id="save-meal-prep-plan" class="ds-btn ds-btn-primary flex items-center gap-2" ${this.isSaving ? 'disabled' : ''}>
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
