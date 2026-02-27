import { AppState } from '../core/app-state.js';
import { StorageService } from '../core/storage-service.js';
import { Toast } from '../core/toast.js';
import { DateUtils } from '../core/date-utils.js';
import { escapeHtml, trapFocus } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { App } from '../app.js';
import { API_BASE_URL } from '../config.js';

export const ShoppingListView = {
    shoppingList: [],
    collapsedCategories: new Set(),
    budget: null,
    budgetAmount: 50,
    optimizationResult: null,
    isOptimizing: false,
    showOptimizationModal: false,
    preferences: {
        prioritizeSeasonal: false,
        prioritizeOrganic: false,
        avoidBrands: true
    },

    render() {
        this.generateShoppingList();

        if (!AppState.weekPlan) {
            return `
                <div class="bg-white rounded-lg shadow p-8 text-center">
                    <p class="text-gray-500">Kein Wochenplan vorhanden.</p>
                    <p class="text-gray-400 text-sm mt-2">
                        Erstelle zuerst einen Wochenplan, um eine Einkaufsliste zu generieren.
                    </p>
                </div>
            `;
        }

        if (this.shoppingList.length === 0) {
            return `
                <div class="space-y-6">
                    <div class="flex justify-between items-center flex-wrap gap-3">
                        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Einkaufsliste</h2>
                        <button id="add-manual-item-btn" class="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded hover:bg-green-600 dark:hover:bg-green-700 transition-colors">
                            + Artikel hinzufügen
                        </button>
                    </div>

                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-8 text-center transition-colors duration-200">
                        <p class="text-gray-500 dark:text-gray-400">Keine Zutaten im Wochenplan.</p>
                        <p class="text-gray-400 dark:text-gray-500 text-sm mt-2">
                            Füge Rezepte zu deinem Wochenplan hinzu oder klicke auf "Artikel hinzufügen", um manuelle Einträge zu erstellen.
                        </p>
                    </div>

                    ${this.renderAddManualItemModal()}
                </div>
            `;
        }

        const checkedCount = this.shoppingList.filter(item => item.checked).length;
        const progress = (checkedCount / this.shoppingList.length) * 100;

        return `
            <div class="space-y-6">
                <div class="flex justify-between items-center flex-wrap gap-3">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Einkaufsliste</h2>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            ${checkedCount} von ${this.shoppingList.length} Artikel${this.shoppingList.length !== 1 ? 'n' : ''} abgehakt
                        </p>
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <button id="add-manual-item-btn" class="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded hover:bg-green-600 dark:hover:bg-green-700 transition-colors">
                            + Artikel hinzufügen
                        </button>
                        <button id="copy-list-btn" class="px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-700 transition-colors">
                            Kopieren
                        </button>
                        <button id="export-list-btn" class="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors">
                            Exportieren
                        </button>
                        ${checkedCount > 0 ? `
                            <button id="clear-checked-btn" class="px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded hover:bg-red-600 dark:hover:bg-red-700 transition-colors">
                                Abgehakte entfernen
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Budget Panel -->
                ${this.renderBudgetPanel()}

                <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-4 transition-colors duration-200">
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div class="bg-green-500 dark:bg-green-600 h-3 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                    </div>
                </div>

                <!-- Optimization Result -->
                ${this.optimizationResult ? this.renderOptimizationResult() : ''}

                ${this.renderCategorizedList()}

                <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 transition-colors duration-200">
                    <p class="text-sm text-blue-800 dark:text-blue-300">
                        <strong>Tipp:</strong> Klicke auf einen Artikel, um ihn als erledigt zu markieren.
                        Du kannst die Liste exportieren oder in die Zwischenablage kopieren.
                    </p>
                </div>

                ${this.renderAddManualItemModal()}
                ${this.renderOptimizationModal()}
            </div>
        `;
    },

    renderBudgetPanel() {
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-4 transition-colors duration-200">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-lg font-semibold text-gray-800 dark:text-white">Budget</span>
                            <span id="budget-display" class="text-2xl font-bold text-green-600 dark:text-green-400">${this.budgetAmount} €</span>
                        </div>
                        <input type="range" id="budget-slider"
                               min="10" max="200" step="5" value="${this.budgetAmount}"
                               class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500">
                        <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <span>10 €</span>
                            <span>200 €</span>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2">
                        <div class="flex items-center gap-2">
                            <input type="checkbox" id="pref-seasonal" ${this.preferences.prioritizeSeasonal ? 'checked' : ''}
                                   class="w-4 h-4 accent-green-500 cursor-pointer">
                            <label for="pref-seasonal" class="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">Saisonal bevorzugen</label>
                        </div>
                        <div class="flex items-center gap-2">
                            <input type="checkbox" id="pref-brands" ${this.preferences.avoidBrands ? 'checked' : ''}
                                   class="w-4 h-4 accent-green-500 cursor-pointer">
                            <label for="pref-brands" class="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">Eigenmarken bevorzugen</label>
                        </div>
                    </div>

                    <button id="optimize-shopping-btn"
                            class="px-6 py-3 bg-purple-500 dark:bg-purple-600 text-white rounded-lg hover:bg-purple-600 dark:hover:bg-purple-700 transition-colors flex items-center gap-2 font-medium ${this.isOptimizing ? 'opacity-50 cursor-not-allowed' : ''}"
                            ${this.isOptimizing ? 'disabled' : ''}>
                        ${this.isOptimizing ? `
                            <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Optimiere...
                        ` : `
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                            KI-Optimierung
                        `}
                    </button>
                </div>
            </div>
        `;
    },

    renderOptimizationResult() {
        const result = this.optimizationResult;
        const savings = result.originalEstimate - result.optimizedEstimate;

        return `
            <div class="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 transition-colors duration-200">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-lg font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        Optimierungsvorschläge
                    </h3>
                    <button id="close-optimization-result" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
                        <p class="text-sm text-gray-500 dark:text-gray-400">Originalkosten</p>
                        <p class="text-xl font-bold text-gray-700 dark:text-gray-300">${result.originalEstimate?.toFixed(2) || '?'} €</p>
                    </div>
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
                        <p class="text-sm text-gray-500 dark:text-gray-400">Optimiert</p>
                        <p class="text-xl font-bold text-green-600 dark:text-green-400">${result.optimizedEstimate?.toFixed(2) || '?'} €</p>
                    </div>
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
                        <p class="text-sm text-gray-500 dark:text-gray-400">Ersparnis</p>
                        <p class="text-xl font-bold text-emerald-600 dark:text-emerald-400">${savings?.toFixed(2) || '?'} € (${result.savingsPercent || 0}%)</p>
                    </div>
                </div>

                ${result.substitutions && result.substitutions.length > 0 ? `
                    <div class="mb-4">
                        <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ersatz-Vorschläge:</h4>
                        <div class="space-y-2">
                            ${result.substitutions.slice(0, 3).map(sub => `
                                <div class="flex items-center justify-between bg-white dark:bg-gray-800 rounded p-2 text-sm">
                                    <span class="text-gray-600 dark:text-gray-400">
                                        <span class="line-through">${escapeHtml(sub.original)}</span>
                                        → <span class="text-green-600 dark:text-green-400 font-medium">${escapeHtml(sub.substitute)}</span>
                                    </span>
                                    <span class="text-green-600 dark:text-green-400 text-xs">-${sub.savingsPercent}%</span>
                                </div>
                            `).join('')}
                            ${result.substitutions.length > 3 ? `
                                <button id="show-all-substitutions" class="text-purple-600 dark:text-purple-400 text-sm hover:underline">
                                    + ${result.substitutions.length - 3} weitere anzeigen
                                </button>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}

                ${result.generalTips && result.generalTips.length > 0 ? `
                    <div class="text-sm text-gray-600 dark:text-gray-400">
                        <strong>Tipps:</strong> ${escapeHtml(result.generalTips[0])}
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderOptimizationModal() {
        if (!this.showOptimizationModal || !this.optimizationResult) return '';

        const result = this.optimizationResult;

        return `
            <div id="optimization-modal" class="modal active">
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-semibold text-gray-800 dark:text-white">Alle Optimierungsvorschläge</h3>
                        <button id="close-optimization-modal" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl">
                            ✕
                        </button>
                    </div>

                    ${result.substitutions && result.substitutions.length > 0 ? `
                        <div class="mb-6">
                            <h4 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">Ersatz-Vorschläge</h4>
                            <div class="space-y-3">
                                ${result.substitutions.map(sub => `
                                    <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                                        <div class="flex items-center justify-between mb-1">
                                            <span class="font-medium text-gray-800 dark:text-white">
                                                ${escapeHtml(sub.original)} → ${escapeHtml(sub.substitute)}
                                            </span>
                                            <span class="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 px-2 py-1 rounded text-sm">
                                                -${sub.savingsPercent}%
                                            </span>
                                        </div>
                                        <p class="text-sm text-gray-600 dark:text-gray-400">${escapeHtml(sub.reason)}</p>
                                        <button class="save-substitution-btn mt-2 text-sm text-purple-600 dark:text-purple-400 hover:underline"
                                                data-original="${escapeHtml(sub.original)}"
                                                data-substitute="${escapeHtml(sub.substitute)}"
                                                data-reason="${escapeHtml(sub.reason)}"
                                                data-savings="${sub.savingsPercent}">
                                            Für zukünftige Einkäufe merken
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${result.seasonalTips && result.seasonalTips.length > 0 ? `
                        <div class="mb-6">
                            <h4 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">Saisonale Tipps</h4>
                            <div class="space-y-2">
                                ${result.seasonalTips.map(tip => `
                                    <div class="flex items-center gap-2 text-sm">
                                        <span class="${tip.isInSeason ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}">
                                            ${tip.isInSeason ? '✓' : '⚠'}
                                        </span>
                                        <span class="font-medium text-gray-700 dark:text-gray-300">${escapeHtml(tip.ingredient)}:</span>
                                        <span class="text-gray-600 dark:text-gray-400">${escapeHtml(tip.tip)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${result.quantityTips && result.quantityTips.length > 0 ? `
                        <div class="mb-6">
                            <h4 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">Mengen-Optimierung</h4>
                            <div class="space-y-2">
                                ${result.quantityTips.map(tip => `
                                    <div class="bg-blue-50 dark:bg-blue-900/20 rounded p-2 text-sm">
                                        <span class="font-medium text-blue-800 dark:text-blue-300">${escapeHtml(tip.ingredient)}:</span>
                                        <span class="text-blue-700 dark:text-blue-400">${escapeHtml(tip.tip)}</span>
                                        ${tip.savingsPercent ? `<span class="text-green-600 dark:text-green-400 ml-2">(-${tip.savingsPercent}%)</span>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${result.generalTips && result.generalTips.length > 0 ? `
                        <div>
                            <h4 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">Allgemeine Tipps</h4>
                            <ul class="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                ${result.generalTips.map(tip => `<li>${escapeHtml(tip)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    renderAddManualItemModal() {
        return `
            <div id="add-manual-item-modal" class="modal">
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-semibold text-gray-800 dark:text-white">Artikel hinzufügen</h3>
                        <button id="close-manual-item-modal" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl">
                            ✕
                        </button>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Artikel *
                            </label>
                            <input type="text" id="manual-item-name"
                                   class="w-full px-3 py-2 border dark:border-gray-600 rounded focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                                   placeholder="z.B. Toilettenpapier, Snacks..."
                                   required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Menge
                            </label>
                            <input type="text" id="manual-item-amount"
                                   class="w-full px-3 py-2 border dark:border-gray-600 rounded focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                                   value="1">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Kategorie
                            </label>
                            <select id="manual-item-category"
                                    class="w-full px-3 py-2 border dark:border-gray-600 rounded focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white">
                                <option value="Obst & Gemüse">Obst & Gemüse</option>
                                <option value="Milchprodukte">Milchprodukte</option>
                                <option value="Fleisch & Fisch">Fleisch & Fisch</option>
                                <option value="Trockenwaren">Trockenwaren</option>
                                <option value="Tiefkühl">Tiefkühl</option>
                                <option value="Sonstiges" selected>Sonstiges</option>
                            </select>
                        </div>
                        <div class="flex gap-2 justify-end">
                            <button id="cancel-manual-item" class="px-4 py-2 border dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                Abbrechen
                            </button>
                            <button id="save-manual-item" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
                                Hinzufügen
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderCategorizedList() {
        const categories = ['Obst & Gemüse', 'Milchprodukte', 'Fleisch & Fisch', 'Trockenwaren', 'Tiefkühl', 'Sonstiges'];

        // Group items by category
        const itemsByCategory = {};
        categories.forEach(cat => itemsByCategory[cat] = []);

        this.shoppingList.forEach((item, index) => {
            const category = item.category || 'Sonstiges';
            if (!itemsByCategory[category]) {
                itemsByCategory['Sonstiges'].push({ ...item, index });
            } else {
                itemsByCategory[category].push({ ...item, index });
            }
        });

        // Render each category
        return categories.map(category => {
            const items = itemsByCategory[category];
            if (items.length === 0) return '';

            const isCollapsed = this.collapsedCategories.has(category);
            const checkedCount = items.filter(item => item.checked).length;

            return `
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 transition-colors duration-200 mb-4">
                    <div class="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                         data-category="${category}">
                        <div class="flex items-center gap-3">
                            <svg class="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}"
                                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                            </svg>
                            <h3 class="text-lg font-semibold text-gray-800 dark:text-white">${category}</h3>
                            <span class="text-sm text-gray-500 dark:text-gray-400">
                                (${checkedCount}/${items.length})
                            </span>
                        </div>
                    </div>

                    <div class="divide-y dark:divide-gray-700 ${isCollapsed ? 'hidden' : ''}">
                        ${items.map(item => `
                            <div class="p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${item.checked ? 'bg-gray-50 dark:bg-gray-700/50' : ''} ${item.isManual ? 'border-l-4 border-green-500 dark:border-green-600' : ''}">
                                <div class="flex items-center gap-3 sm:gap-4">
                                    <!-- Large touch-friendly checkbox -->
                                    <label class="relative flex items-center justify-center cursor-pointer">
                                        <input type="checkbox" ${item.checked ? 'checked' : ''}
                                               class="item-checkbox touch-checkbox w-7 h-7 sm:w-6 sm:h-6 cursor-pointer accent-blue-500 dark:accent-blue-400 rounded"
                                               data-item-index="${item.index}">
                                    </label>
                                    <div class="flex-1 min-w-0 cursor-pointer py-1" data-item-index="${item.index}">
                                        <div class="flex items-start justify-between gap-2">
                                            <p class="font-medium text-gray-800 dark:text-white text-sm sm:text-base ${item.checked ? 'line-through text-gray-500 dark:text-gray-400' : ''}">
                                                <span class="font-semibold">${item.amount}</span> ${item.unit} ${item.name}
                                                ${item.isManual ? '<span class="ml-2 text-xs bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 px-2 py-0.5 rounded">Manuell</span>' : ''}
                                            </p>
                                            ${item.isManual ? `
                                                <button class="delete-manual-item-btn p-2 -mr-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                        data-item-id="${item.id}"
                                                        aria-label="Artikel löschen">
                                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                                    </svg>
                                                </button>
                                            ` : ''}
                                        </div>
                                        ${item.recipeNames.length > 0 ? `
                                            <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                                                Für: ${item.recipeNames.join(', ')}
                                            </p>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    },

    async generateShoppingList() {
        const ingredientsMap = new Map();

        // Add ingredients from week plan
        if (AppState.weekPlan) {
            for (const day of AppState.weekPlan.days) {
                for (const meal of Object.values(day.meals)) {
                    if (meal?.recipeId) {
                        const recipe = await StorageService.getRecipeById(meal.recipeId);
                        if (recipe) {
                            recipe.ingredients.forEach(ingredient => {
                                const key = `${ingredient.name.toLowerCase()}_${ingredient.unit.toLowerCase()}`;

                                if (ingredientsMap.has(key)) {
                                    const existing = ingredientsMap.get(key);
                                    const existingAmount = parseFloat(existing.amount);
                                    const newAmount = parseFloat(ingredient.amount);

                                    if (!isNaN(existingAmount) && !isNaN(newAmount)) {
                                        existing.amount = (existingAmount + newAmount).toString();
                                    } else {
                                        existing.amount = `${existing.amount} + ${ingredient.amount}`;
                                    }

                                    if (!existing.recipeNames.includes(recipe.name)) {
                                        existing.recipeNames.push(recipe.name);
                                    }
                                } else {
                                    ingredientsMap.set(key, {
                                        name: ingredient.name,
                                        amount: ingredient.amount,
                                        unit: ingredient.unit,
                                        category: ingredient.category || 'Sonstiges',
                                        checked: false,
                                        recipeNames: [recipe.name],
                                        isManual: false
                                    });
                                }
                            });
                        }
                    }
                }
            }
        }

        // Add manual shopping items
        const manualItems = await StorageService.getManualShoppingItems();
        manualItems.forEach(item => {
            ingredientsMap.set(`manual_${item.id}`, {
                id: item.id,
                name: item.name,
                amount: item.amount,
                unit: item.unit,
                category: item.category || 'Sonstiges',
                checked: false,
                recipeNames: [],
                isManual: true
            });
        });

        this.shoppingList = Array.from(ingredientsMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
        );
    },

    attachEventListeners() {
        // Category collapse/expand
        document.querySelectorAll('[data-category]').forEach(header => {
            header.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                if (this.collapsedCategories.has(category)) {
                    this.collapsedCategories.delete(category);
                } else {
                    this.collapsedCategories.add(category);
                }
                App.render();
            });
        });

        // Toggle checkboxes
        document.querySelectorAll('.item-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.itemIndex);
                this.shoppingList[index].checked = e.target.checked;
                App.render();
            });
        });

        // Click on item to toggle
        document.querySelectorAll('[data-item-index]').forEach(item => {
            if (!item.classList.contains('item-checkbox')) {
                item.addEventListener('click', (e) => {
                    if (e.target.classList.contains('item-checkbox')) return;
                    const index = parseInt(e.currentTarget.dataset.itemIndex);
                    this.shoppingList[index].checked = !this.shoppingList[index].checked;
                    App.render();
                });
            }
        });

        // Copy to clipboard
        const copyBtn = document.getElementById('copy-list-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyToClipboard());
        }

        // Export to file
        const exportBtn = document.getElementById('export-list-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportToFile());
        }

        // Clear checked items
        const clearBtn = document.getElementById('clear-checked-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.shoppingList = this.shoppingList.filter(item => !item.checked);
                App.render();
            });
        }

        // Add manual item button
        const addManualBtn = document.getElementById('add-manual-item-btn');
        if (addManualBtn) {
            addManualBtn.addEventListener('click', () => this.showAddManualItemModal());
        }

        // Close manual item modal
        const closeModalBtn = document.getElementById('close-manual-item-modal');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => this.hideAddManualItemModal());
        }

        // Cancel manual item
        const cancelBtn = document.getElementById('cancel-manual-item');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideAddManualItemModal());
        }

        // Save manual item
        const saveBtn = document.getElementById('save-manual-item');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveManualItem());
        }

        // Delete manual items
        document.querySelectorAll('.delete-manual-item-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent checkbox toggle
                const itemId = e.target.dataset.itemId;
                await this.deleteManualItem(itemId);
            });
        });

        // Budget slider
        const budgetSlider = document.getElementById('budget-slider');
        if (budgetSlider) {
            budgetSlider.addEventListener('input', (e) => {
                this.budgetAmount = parseInt(e.target.value);
                const display = document.getElementById('budget-display');
                if (display) display.textContent = `${this.budgetAmount} €`;
            });
        }

        // Preferences checkboxes
        const prefSeasonal = document.getElementById('pref-seasonal');
        if (prefSeasonal) {
            prefSeasonal.addEventListener('change', (e) => {
                this.preferences.prioritizeSeasonal = e.target.checked;
            });
        }

        const prefBrands = document.getElementById('pref-brands');
        if (prefBrands) {
            prefBrands.addEventListener('change', (e) => {
                this.preferences.avoidBrands = e.target.checked;
            });
        }

        // Optimize button
        const optimizeBtn = document.getElementById('optimize-shopping-btn');
        if (optimizeBtn) {
            optimizeBtn.addEventListener('click', () => this.optimizeShoppingList());
        }

        // Close optimization result
        const closeOptResult = document.getElementById('close-optimization-result');
        if (closeOptResult) {
            closeOptResult.addEventListener('click', () => {
                this.optimizationResult = null;
                App.render();
            });
        }

        // Show all substitutions
        const showAllBtn = document.getElementById('show-all-substitutions');
        if (showAllBtn) {
            showAllBtn.addEventListener('click', () => {
                this.showOptimizationModal = true;
                App.render();
            });
        }

        // Close optimization modal
        const closeOptModal = document.getElementById('close-optimization-modal');
        if (closeOptModal) {
            closeOptModal.addEventListener('click', () => {
                this.showOptimizationModal = false;
                App.render();
            });
        }

        // Save substitution preferences
        document.querySelectorAll('.save-substitution-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const original = e.target.dataset.original;
                const substitute = e.target.dataset.substitute;
                const reason = e.target.dataset.reason;
                const savings = parseInt(e.target.dataset.savings);
                await this.saveSubstitutionPreference(original, substitute, reason, savings);
            });
        });
    },

    _releaseFocusTrap: null,

    showAddManualItemModal() {
        const modal = document.getElementById('add-manual-item-modal');
        if (modal) {
            modal.classList.add('active');
            this._releaseFocusTrap = trapFocus(modal);
        }
    },

    hideAddManualItemModal() {
        if (this._releaseFocusTrap) {
            this._releaseFocusTrap();
            this._releaseFocusTrap = null;
        }
        const modal = document.getElementById('add-manual-item-modal');
        if (modal) modal.classList.remove('active');
        // Clear inputs
        document.getElementById('manual-item-name').value = '';
        document.getElementById('manual-item-amount').value = '1';
        document.getElementById('manual-item-category').value = 'Sonstiges';
    },

    async saveManualItem() {
        const name = document.getElementById('manual-item-name').value.trim();
        const amount = document.getElementById('manual-item-amount').value.trim() || '1';
        const category = document.getElementById('manual-item-category').value;

        if (!name) {
            Toast.error('Bitte gib einen Artikelnamen ein');
            return;
        }

        const item = {
            id: Date.now().toString(),
            name,
            amount,
            unit: 'x',
            category
        };

        try {
            await StorageService.addManualShoppingItem(item);
            this.hideAddManualItemModal();
            await this.generateShoppingList();
            App.render();
            Toast.success(`"${name}" zur Einkaufsliste hinzugefügt ✓`);
        } catch (error) {
            Toast.error('Fehler beim Hinzufügen des Artikels');
            console.error(error);
        }
    },

    async deleteManualItem(itemId) {
        try {
            await StorageService.deleteManualShoppingItem(itemId);
            await this.generateShoppingList();
            App.render();
            Toast.success('Artikel gelöscht');
        } catch (error) {
            Toast.error('Fehler beim Löschen des Artikels');
            console.error(error);
        }
    },

    copyToClipboard() {
        const text = this.shoppingList
            .map(item => `${item.amount} ${item.unit} ${item.name}`)
            .join('\n');

        navigator.clipboard.writeText(text).then(() => {
            Toast.success('In Zwischenablage kopiert ✓');
        });
    },

    exportToFile() {
        const text = this.shoppingList
            .map(item => {
                const checkbox = item.checked ? '[✓]' : '[ ]';
                return `${checkbox} ${item.amount} ${item.unit} ${item.name}`;
            })
            .join('\n');

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'einkaufsliste.txt';
        a.click();
        URL.revokeObjectURL(url);
    },

    async optimizeShoppingList() {
        if (this.shoppingList.length === 0) {
            Toast.error('Keine Artikel in der Einkaufsliste');
            return;
        }

        this.isOptimizing = true;
        App.render();

        try {
            const response = await fetch(`${API_BASE_URL}/shopping/optimize`, {
                method: 'POST',
                headers: Auth.authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    shoppingList: this.shoppingList.map(item => ({
                        name: item.name,
                        amount: item.amount,
                        unit: item.unit,
                        category: item.category
                    })),
                    budget: this.budgetAmount,
                    preferences: this.preferences
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Optimierung fehlgeschlagen');
            }

            this.optimizationResult = await response.json();
            Toast.success('Optimierungsvorschläge erstellt');
        } catch (error) {
            console.error('Optimization error:', error);
            Toast.error(error.message || 'Fehler bei der Optimierung');
        } finally {
            this.isOptimizing = false;
            App.render();
        }
    },

    async saveSubstitutionPreference(original, substitute, reason, savingsPercent) {
        try {
            const response = await fetch(`${API_BASE_URL}/shopping/substitutions`, {
                method: 'POST',
                headers: Auth.authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    originalIngredient: original,
                    substituteIngredient: substitute,
                    reason: reason,
                    savingsPercent: savingsPercent
                })
            });

            if (!response.ok) {
                throw new Error('Fehler beim Speichern');
            }

            Toast.success(`Substitution "${original} → ${substitute}" gespeichert`);
        } catch (error) {
            console.error('Save substitution error:', error);
            Toast.error('Fehler beim Speichern der Substitution');
        }
    },

    async saveBudget() {
        const weekStart = DateUtils.getMonday(new Date()).toISOString().split('T')[0];

        try {
            await fetch(`${API_BASE_URL}/shopping/budget`, {
                method: 'POST',
                headers: Auth.authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    weekStart: weekStart,
                    budgetAmount: this.budgetAmount
                })
            });
        } catch (error) {
            console.error('Save budget error:', error);
        }
    },

    async loadBudget() {
        const weekStart = DateUtils.getMonday(new Date()).toISOString().split('T')[0];

        try {
            const response = await fetch(`${API_BASE_URL}/shopping/budget/${weekStart}`);
            if (response.ok) {
                const budget = await response.json();
                if (budget && budget.budget_amount) {
                    this.budgetAmount = parseFloat(budget.budget_amount);
                }
            }
        } catch (error) {
            console.error('Load budget error:', error);
        }
    }
};

// Pantry View
