import { AppState } from '../core/app-state.js';
import { StorageService } from '../core/storage-service.js';
import { Toast } from '../core/toast.js';
import { DateUtils } from '../core/date-utils.js';
import { escapeHtml, trapFocus } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { App } from '../app.js';
import { API_BASE_URL, DEFAULT_DEPARTMENTS, INGREDIENT_CATEGORIES, CATEGORY_TO_DEPARTMENT } from '../config.js';
import { api } from '../core/api.js';

// Keyword mapping for supermarket department assignment
const DEPARTMENT_KEYWORDS = {
    fruits_veggies: [
        'apfel', 'birne', 'banane', 'orange', 'zitrone', 'erdbeere', 'himbeere', 'blaubeere', 'traube', 'melone',
        'tomate', 'gurke', 'paprika', 'zwiebel', 'knoblauch', 'kartoffel', 'karotte', 'möhre', 'salat', 'spinat',
        'brokkoli', 'blumenkohl', 'kohl', 'zucchini', 'aubergine', 'kürbis', 'sellerie', 'lauch', 'radieschen',
        'pilz', 'champignon', 'petersilie', 'basilikum', 'thymian', 'rosmarin', 'koriander', 'schnittlauch',
        'avocado', 'mango', 'ananas', 'kiwi', 'pfirsich', 'pflaume', 'kirsche', 'gemüse', 'obst',
        'frühlingszwiebel', 'fenchel', 'rucola', 'mangold', 'rettich', 'ingwer', 'chili', 'limette', 'granatapfel'
    ],
    bread: [
        'brot', 'brötchen', 'semmel', 'toast', 'baguette', 'croissant', 'brezel', 'laugenstange',
        'knäckebrot', 'zwieback', 'tortilla', 'wrap', 'fladenbrot', 'ciabatta', 'pumpernickel'
    ],
    dairy: [
        'milch', 'sahne', 'butter', 'joghurt', 'quark', 'schmand', 'crème fraîche', 'crème',
        'mascarpone', 'schlagsahne', 'buttermilch', 'kefir', 'saure sahne', 'kaffeesahne'
    ],
    eggs: [
        'eier', 'eigelb', 'eiweiß'
    ],
    meat_fish: [
        'fleisch', 'huhn', 'hähnchen', 'pute', 'rind', 'schwein', 'lamm', 'hack', 'wurst',
        'fisch', 'lachs', 'thunfisch', 'forelle', 'kabeljau', 'garnele', 'shrimp', 'muschel',
        'steak', 'schnitzel', 'filet', 'bacon', 'bratwurst', 'gulasch', 'braten', 'geschnetzeltes'
    ],
    cheese_deli: [
        'käse', 'mozzarella', 'parmesan', 'gouda', 'feta', 'ricotta', 'frischkäse', 'emmentaler',
        'cheddar', 'camembert', 'brie', 'schinken', 'salami', 'aufschnitt', 'speck', 'mortadella',
        'leberwurst', 'mettwurst', 'prosciutto'
    ],
    canned: [
        'konserve', 'dose', 'passierte', 'tomatenmark', 'kokosmilch', 'kokosnussmilch',
        'kichererbsen', 'bohnen', 'mais', 'erbsen', 'linsen', 'oliven', 'kapern',
        'eingelegte', 'gewürzgurke', 'sauerkraut', 'thunfisch in'
    ],
    dry_goods: [
        'mehl', 'zucker', 'salz', 'pfeffer', 'reis', 'nudel', 'pasta', 'spaghetti', 'penne', 'fusilli',
        'hafer', 'müsli', 'cornflakes', 'honig', 'marmelade', 'öl', 'essig', 'gewürz',
        'backpulver', 'hefe', 'vanille', 'zimt', 'kakao', 'schokolade', 'nuss', 'mandel', 'walnuss',
        'haselnuss', 'rosine', 'dattel', 'couscous', 'quinoa', 'bulgur', 'kaffee', 'tee',
        'sojasoße', 'sojasauce', 'senf', 'ketchup', 'mayonnaise', 'currypulver', 'paprikapulver',
        'paniermehl', 'speisestärke', 'gelatine', 'agavendicksaft', 'ahornsirup'
    ],
    frozen: [
        'tiefkühl', 'gefroren', 'tk-', 'eiscreme', 'tiefgekühlt', 'pizza tiefkühl',
        'pommes', 'kroketten', 'fischstäbchen', 'blätterteig', 'gefrorene'
    ],
    household: [
        'spülmittel', 'waschmittel', 'toilettenpapier', 'küchenrolle', 'müllbeutel',
        'schwamm', 'seife', 'shampoo', 'zahnpasta', 'alufolie', 'frischhaltefolie',
        'backpapier', 'serviette', 'taschentuch'
    ]
};

/**
 * Assigns a shopping item to a supermarket department based on keyword matching.
 * Falls back to mapping from existing backend categories.
 */
function assignDepartment(item) {
    const name = item.name.toLowerCase();

    // Special case: "Ei" as whole word (too short for substring matching)
    if (/\bei\b/.test(name)) return 'eggs';

    // Direct keyword match against department keywords
    for (const [deptId, keywords] of Object.entries(DEPARTMENT_KEYWORDS)) {
        for (const keyword of keywords) {
            if (name.includes(keyword)) {
                return deptId;
            }
        }
    }

    // Fallback: map existing backend category to department
    return CATEGORY_TO_DEPARTMENT[item.category] || 'other';
}

export const ShoppingListView = {
    shoppingList: [],
    collapsedCategories: new Set(),
    budget: null,
    budgetAmount: 50,
    optimizationResult: null,
    isOptimizing: false,
    showOptimizationModal: false,
    usePantry: localStorage.getItem('shopping_use_pantry') !== 'false', // default: true
    pantryCheckResult: null,
    sortMode: localStorage.getItem('shopping_sort_mode') || 'supermarket', // 'supermarket' or 'alphabetical'
    departmentOrder: JSON.parse(localStorage.getItem('shopping_department_order') || 'null') || DEFAULT_DEPARTMENTS.map(d => d.id),
    preferences: {
        prioritizeSeasonal: false,
        prioritizeOrganic: false,
        avoidBrands: true
    },

    render() {
        this.generateShoppingList();

        if (!AppState.weekPlan) {
            return `
                <div class="ds-card p-8 text-center">
                    <p class="text-ds-text-muted">Kein Wochenplan vorhanden.</p>
                    <p class="text-ds-text-muted text-sm mt-2">
                        Erstelle zuerst einen Wochenplan, um eine Einkaufsliste zu generieren.
                    </p>
                </div>
            `;
        }

        if (this.shoppingList.length === 0) {
            return `
                <div class="space-y-6">
                    <div class="flex justify-between items-center flex-wrap gap-3">
                        <h2 class="ds-page-title">Einkaufsliste</h2>
                        <button id="add-manual-item-btn" class="ds-btn ds-btn-primary px-4 py-2">
                            + Artikel hinzufügen
                        </button>
                    </div>

                    <div class="ds-card p-8 text-center">
                        <p class="text-ds-text-muted">Keine Zutaten im Wochenplan.</p>
                        <p class="text-ds-text-muted text-sm mt-2">
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
                        <h2 class="ds-page-title">Einkaufsliste</h2>
                        <p class="ds-page-sub mt-1">
                            ${checkedCount} von ${this.shoppingList.length} Artikel${this.shoppingList.length !== 1 ? 'n' : ''} abgehakt
                        </p>
                    </div>
                    <div class="flex gap-2 flex-wrap">
                        <button id="toggle-sort-btn" class="ds-btn ds-btn-secondary px-4 py-2" title="${this.sortMode === 'supermarket' ? 'Aktuell: Supermarkt-Reihenfolge' : 'Aktuell: Alphabetisch'}">
                            ${this.sortMode === 'supermarket' ? '🏪 Supermarkt' : '🔤 Alphabetisch'}
                        </button>
                        <button id="add-manual-item-btn" class="ds-btn ds-btn-primary px-4 py-2">
                            + Artikel hinzufügen
                        </button>
                        <button id="copy-list-btn" class="ds-btn ds-btn-secondary px-4 py-2">
                            Kopieren
                        </button>
                        <button id="export-list-btn" class="ds-btn ds-btn-secondary px-4 py-2">
                            Exportieren
                        </button>
                        ${checkedCount > 0 ? `
                            <button id="clear-checked-btn" class="ds-btn ds-btn-destructive px-4 py-2">
                                Abgehakte entfernen
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Budget Panel -->
                ${this.renderBudgetPanel()}

                <div class="ds-card p-4">
                    <div class="w-full bg-ds-bg-subtle rounded-full h-2">
                        <div class="bg-ds-text h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                    </div>
                </div>

                <!-- Pantry Toggle & Banner -->
                ${this.renderPantryPanel()}

                <!-- Optimization Result -->
                ${this.optimizationResult ? this.renderOptimizationResult() : ''}

                ${this.renderCategorizedList()}

                <div class="bg-blue-50 border border-ds-border rounded-lg p-4">
                    <p class="text-sm text-blue-800">
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
            <div class="ds-card p-4">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="ds-section-title">Budget</span>
                            <span id="budget-display" class="text-2xl font-bold text-green-600">${this.budgetAmount} €</span>
                        </div>
                        <input type="range" id="budget-slider"
                               min="10" max="200" step="5" value="${this.budgetAmount}"
                               class="w-full h-2 bg-ds-bg-subtle rounded-lg appearance-none cursor-pointer accent-green-500">
                        <div class="flex justify-between text-xs text-ds-text-muted mt-1">
                            <span>10 €</span>
                            <span>200 €</span>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2">
                        <div class="flex items-center gap-2">
                            <input type="checkbox" id="pref-seasonal" ${this.preferences.prioritizeSeasonal ? 'checked' : ''}
                                   class="w-4 h-4 accent-green-500 cursor-pointer">
                            <label for="pref-seasonal" class="text-sm text-ds-text-body cursor-pointer">Saisonal bevorzugen</label>
                        </div>
                        <div class="flex items-center gap-2">
                            <input type="checkbox" id="pref-brands" ${this.preferences.avoidBrands ? 'checked' : ''}
                                   class="w-4 h-4 accent-green-500 cursor-pointer">
                            <label for="pref-brands" class="text-sm text-ds-text-body cursor-pointer">Eigenmarken bevorzugen</label>
                        </div>
                    </div>

                    <button id="optimize-shopping-btn"
                            class="ds-btn ds-btn-secondary px-6 py-3 rounded-lg flex items-center gap-2 font-medium ${this.isOptimizing ? 'opacity-50 cursor-not-allowed' : ''}"
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

    renderPantryPanel() {
        const summary = this.pantryCheckResult?.summary;
        const hasDeductions = summary && (summary.fullyAvailable > 0 || summary.partiallyAvailable > 0);

        return `
            <div class="ds-card p-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                        </svg>
                        <span class="text-sm font-medium text-ds-text-body">Vorräte berücksichtigen</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="pantry-toggle" class="sr-only peer" ${this.usePantry ? 'checked' : ''}>
                        <div class="w-11 h-6 bg-ds-bg-subtle peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                </div>
                ${hasDeductions ? `
                    <div class="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg p-2">
                        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span>
                            ${summary.fullyAvailable} Zutat${summary.fullyAvailable !== 1 ? 'en' : ''} vollständig im Vorrat${summary.partiallyAvailable > 0 ? `, ${summary.partiallyAvailable} teilweise vorhanden` : ''}
                        </span>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderOptimizationResult() {
        const result = this.optimizationResult;
        const savings = result.originalEstimate - result.optimizedEstimate;

        return `
            <div class="bg-gradient-to-r from-green-50 to-emerald-50 border border-ds-border rounded-lg p-4">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="ds-section-title text-green-800 flex items-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        Optimierungsvorschläge
                    </h3>
                    <button id="close-optimization-result" class="text-ds-text-muted hover:text-ds-text">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div class="bg-ds-bg rounded-lg p-3 text-center">
                        <p class="text-sm text-ds-text-muted">Originalkosten</p>
                        <p class="text-xl font-bold text-ds-text-body">${result.originalEstimate?.toFixed(2) || '?'} €</p>
                    </div>
                    <div class="bg-ds-bg rounded-lg p-3 text-center">
                        <p class="text-sm text-ds-text-muted">Optimiert</p>
                        <p class="text-xl font-bold text-green-600">${result.optimizedEstimate?.toFixed(2) || '?'} €</p>
                    </div>
                    <div class="bg-ds-bg rounded-lg p-3 text-center">
                        <p class="text-sm text-ds-text-muted">Ersparnis</p>
                        <p class="text-xl font-bold text-emerald-600">${savings?.toFixed(2) || '?'} € (${result.savingsPercent || 0}%)</p>
                    </div>
                </div>

                ${result.substitutions && result.substitutions.length > 0 ? `
                    <div class="mb-4">
                        <h4 class="text-sm font-semibold text-ds-text-body mb-2">Ersatz-Vorschläge:</h4>
                        <div class="space-y-2">
                            ${result.substitutions.slice(0, 3).map(sub => `
                                <div class="flex items-center justify-between bg-ds-bg rounded p-2 text-sm">
                                    <span class="text-ds-text-sec">
                                        <span class="line-through">${escapeHtml(sub.original)}</span>
                                        → <span class="text-green-600 font-medium">${escapeHtml(sub.substitute)}</span>
                                    </span>
                                    <span class="text-green-600 text-xs">-${sub.savingsPercent}%</span>
                                </div>
                            `).join('')}
                            ${result.substitutions.length > 3 ? `
                                <button id="show-all-substitutions" class="text-purple-600 text-sm hover:underline">
                                    + ${result.substitutions.length - 3} weitere anzeigen
                                </button>
                            ` : ''}
                        </div>
                    </div>
                ` : ''}

                ${result.generalTips && result.generalTips.length > 0 ? `
                    <div class="text-sm text-ds-text-sec">
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
                <div class="bg-ds-bg rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-semibold text-ds-text">Alle Optimierungsvorschläge</h3>
                        <button id="close-optimization-modal" class="text-ds-text-muted hover:text-ds-text text-2xl">
                            ✕
                        </button>
                    </div>

                    ${result.substitutions && result.substitutions.length > 0 ? `
                        <div class="mb-6">
                            <h4 class="ds-section-title mb-3">Ersatz-Vorschläge</h4>
                            <div class="space-y-3">
                                ${result.substitutions.map(sub => `
                                    <div class="bg-ds-bg-muted rounded-lg p-3">
                                        <div class="flex items-center justify-between mb-1">
                                            <span class="font-medium text-ds-text">
                                                ${escapeHtml(sub.original)} → ${escapeHtml(sub.substitute)}
                                            </span>
                                            <span class="ds-badge px-2 py-1 text-sm">
                                                -${sub.savingsPercent}%
                                            </span>
                                        </div>
                                        <p class="text-sm text-ds-text-sec">${escapeHtml(sub.reason)}</p>
                                        <button class="save-substitution-btn mt-2 text-sm text-purple-600 hover:underline"
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
                            <h4 class="ds-section-title mb-3">Saisonale Tipps</h4>
                            <div class="space-y-2">
                                ${result.seasonalTips.map(tip => `
                                    <div class="flex items-center gap-2 text-sm">
                                        <span class="${tip.isInSeason ? 'text-green-600' : 'text-orange-600'}">
                                            ${tip.isInSeason ? '✓' : '⚠'}
                                        </span>
                                        <span class="font-medium text-ds-text-body">${escapeHtml(tip.ingredient)}:</span>
                                        <span class="text-ds-text-sec">${escapeHtml(tip.tip)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${result.quantityTips && result.quantityTips.length > 0 ? `
                        <div class="mb-6">
                            <h4 class="ds-section-title mb-3">Mengen-Optimierung</h4>
                            <div class="space-y-2">
                                ${result.quantityTips.map(tip => `
                                    <div class="bg-blue-50 rounded p-2 text-sm">
                                        <span class="font-medium text-blue-800">${escapeHtml(tip.ingredient)}:</span>
                                        <span class="text-blue-700">${escapeHtml(tip.tip)}</span>
                                        ${tip.savingsPercent ? `<span class="text-green-600 ml-2">(-${tip.savingsPercent}%)</span>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${result.generalTips && result.generalTips.length > 0 ? `
                        <div>
                            <h4 class="ds-section-title mb-3">Allgemeine Tipps</h4>
                            <ul class="list-disc list-inside space-y-1 text-sm text-ds-text-sec">
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
                <div class="bg-ds-bg rounded-lg max-w-md w-full p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-semibold text-ds-text">Artikel hinzufügen</h3>
                        <button id="close-manual-item-modal" class="text-ds-text-muted hover:text-ds-text text-2xl">
                            ✕
                        </button>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-ds-text-body mb-1">
                                Artikel *
                            </label>
                            <input type="text" id="manual-item-name"
                                   class="ds-input w-full"
                                   placeholder="z.B. Toilettenpapier, Snacks..."
                                   required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-ds-text-body mb-1">
                                Menge
                            </label>
                            <input type="text" id="manual-item-amount"
                                   class="ds-input w-full"
                                   value="1">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-ds-text-body mb-1">
                                Kategorie
                            </label>
                            <select id="manual-item-category"
                                    class="ds-input w-full">
                                ${INGREDIENT_CATEGORIES.map(c =>
                                    `<option value="${c}"${c === 'Sonstiges' ? ' selected' : ''}>${c}</option>`
                                ).join('\n                                ')}
                            </select>
                        </div>
                        <div class="flex gap-2 justify-end">
                            <button id="cancel-manual-item" class="ds-btn ds-btn-secondary px-4 py-2">
                                Abbrechen
                            </button>
                            <button id="save-manual-item" class="ds-btn ds-btn-primary px-4 py-2">
                                Hinzufügen
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderCategorizedList() {
        if (this.sortMode === 'supermarket') {
            return this.renderSupermarketList();
        }
        return this.renderAlphabeticalList();
    },

    renderItemHtml(item) {
        const pantryInfo = item.pantryInfo;
        const isFullyAvailable = pantryInfo?.fullyAvailable;
        const isPartial = pantryInfo?.partiallyAvailable;
        const displayAmount = pantryInfo ? pantryInfo.adjustedAmount : item.amount;
        const strikeClass = isFullyAvailable ? 'line-through text-ds-text-muted' : '';

        return `
            <div class="p-3 sm:p-4 hover:bg-ds-bg-muted transition-colors ${item.checked || isFullyAvailable ? 'bg-ds-bg-muted' : ''} ${item.isManual ? 'border-l-4 border-green-500' : ''} ${isFullyAvailable ? 'opacity-60' : ''}">
                <div class="flex items-center gap-3 sm:gap-4">
                    <label class="relative flex items-center justify-center cursor-pointer">
                        <input type="checkbox" ${item.checked ? 'checked' : ''}
                               class="item-checkbox touch-checkbox w-7 h-7 sm:w-6 sm:h-6 cursor-pointer rounded"
                               data-item-index="${item.index}">
                    </label>
                    <div class="flex-1 min-w-0 cursor-pointer py-1" data-item-index="${item.index}">
                        <div class="flex items-start justify-between gap-2">
                            <p class="font-medium text-ds-text text-sm sm:text-base ${item.checked ? 'line-through text-ds-text-muted' : ''} ${strikeClass}">
                                <span class="font-semibold">${isFullyAvailable ? item.amount : displayAmount}</span> ${item.unit} ${item.name}
                                ${item.isManual ? '<span class="ml-2 text-xs ds-badge px-2 py-0.5 rounded">Manuell</span>' : ''}
                                ${isFullyAvailable ? '<span class="ml-2 text-xs ds-badge px-2 py-0.5 rounded">Im Vorrat</span>' : ''}
                            </p>
                            ${item.isManual ? `
                                <button class="delete-manual-item-btn p-2 -mr-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                        data-item-id="${item.id}"
                                        aria-label="Artikel löschen">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                        ${isPartial && pantryInfo.pantryAmount > 0 ? `
                            <p class="text-xs text-amber-600 mt-0.5">
                                ${pantryInfo.pantryAmount} ${pantryInfo.pantryUnit || item.unit} im Vorrat
                            </p>
                        ` : ''}
                        ${item.recipeNames.length > 0 ? `
                            <p class="text-xs sm:text-sm text-ds-text-muted mt-1 truncate">
                                Für: ${item.recipeNames.join(', ')}
                            </p>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    renderGroupHtml(groupKey, label, items) {
        if (items.length === 0) return '';
        const isCollapsed = this.collapsedCategories.has(groupKey);
        const checkedCount = items.filter(item => item.checked).length;

        return `
            <div class="ds-card mb-4">
                <div class="flex items-center justify-between p-4 cursor-pointer hover:bg-ds-bg-muted transition-colors"
                     data-category="${groupKey}">
                    <div class="flex items-center gap-3">
                        <svg class="w-5 h-5 text-ds-text-muted transition-transform ${isCollapsed ? '' : 'rotate-90'}"
                             fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                        <h3 class="ds-section-title">${label}</h3>
                        <span class="text-sm text-ds-text-muted">
                            (${checkedCount}/${items.length})
                        </span>
                    </div>
                </div>
                <div class="divide-y divide-ds-border ${isCollapsed ? 'hidden' : ''}">
                    ${items.map(item => this.renderItemHtml(item)).join('')}
                </div>
            </div>
        `;
    },

    renderSupermarketList() {
        const deptMap = new Map();
        this.departmentOrder.forEach(id => deptMap.set(id, []));
        if (!deptMap.has('other')) deptMap.set('other', []);

        this.shoppingList.forEach((item, index) => {
            const deptId = assignDepartment(item);
            const target = deptMap.get(deptId) || deptMap.get('other');
            target.push({ ...item, index });
        });

        const deptLookup = Object.fromEntries(DEFAULT_DEPARTMENTS.map(d => [d.id, d]));

        return this.departmentOrder.map(deptId => {
            const dept = deptLookup[deptId];
            if (!dept) return '';
            const items = deptMap.get(deptId) || [];
            return this.renderGroupHtml(deptId, `${dept.emoji} ${dept.name}`, items);
        }).join('');
    },

    renderAlphabeticalList() {
        const itemsByCategory = {};
        INGREDIENT_CATEGORIES.forEach(cat => itemsByCategory[cat] = []);

        this.shoppingList.forEach((item, index) => {
            const category = item.category || 'Sonstiges';
            if (!itemsByCategory[category]) {
                itemsByCategory['Sonstiges'].push({ ...item, index });
            } else {
                itemsByCategory[category].push({ ...item, index });
            }
        });

        return INGREDIENT_CATEGORIES.map(category => {
            return this.renderGroupHtml(category, category, itemsByCategory[category]);
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

        // Check pantry availability if enabled
        if (this.usePantry && this.shoppingList.length > 0) {
            try {
                const itemsToCheck = this.shoppingList
                    .filter(item => !item.isManual)
                    .map(item => ({ name: item.name, amount: item.amount, unit: item.unit }));

                if (itemsToCheck.length > 0) {
                    this.pantryCheckResult = await StorageService.checkPantryAvailability(itemsToCheck);

                    // Merge pantry info into shopping list items
                    if (this.pantryCheckResult?.items) {
                        const pantryMap = new Map();
                        for (const pItem of this.pantryCheckResult.items) {
                            pantryMap.set(`${pItem.name.toLowerCase()}_${pItem.unit.toLowerCase()}`, pItem);
                        }
                        for (const item of this.shoppingList) {
                            if (item.isManual) continue;
                            const key = `${item.name.toLowerCase()}_${item.unit.toLowerCase()}`;
                            const pantryInfo = pantryMap.get(key);
                            if (pantryInfo && (pantryInfo.fullyAvailable || pantryInfo.partiallyAvailable)) {
                                item.pantryInfo = pantryInfo;
                            }
                        }
                    }
                }
            } catch {
                // Silently fail — shopping list works without pantry check
                this.pantryCheckResult = null;
            }
        } else {
            this.pantryCheckResult = null;
            // Clear pantry info from items
            for (const item of this.shoppingList) {
                delete item.pantryInfo;
            }
        }
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

        // Sort mode toggle
        const sortToggleBtn = document.getElementById('toggle-sort-btn');
        if (sortToggleBtn) {
            sortToggleBtn.addEventListener('click', () => {
                this.sortMode = this.sortMode === 'supermarket' ? 'alphabetical' : 'supermarket';
                localStorage.setItem('shopping_sort_mode', this.sortMode);
                App.render();
            });
        }

        // Delete manual items
        document.querySelectorAll('.delete-manual-item-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent checkbox toggle
                const itemId = e.target.dataset.itemId;
                await this.deleteManualItem(itemId);
            });
        });

        // Pantry toggle
        const pantryToggle = document.getElementById('pantry-toggle');
        if (pantryToggle) {
            pantryToggle.addEventListener('change', async (e) => {
                this.usePantry = e.target.checked;
                localStorage.setItem('shopping_use_pantry', String(this.usePantry));
                await this.generateShoppingList();
                App.render();
            });
        }

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

    _formatListGrouped() {
        if (this.sortMode !== 'supermarket') {
            return this.shoppingList.map(item => ({
                text: `${item.amount} ${item.unit} ${item.name}`,
                checked: item.checked
            }));
        }
        const deptLookup = Object.fromEntries(DEFAULT_DEPARTMENTS.map(d => [d.id, d]));
        const deptMap = new Map();
        this.departmentOrder.forEach(id => deptMap.set(id, []));
        if (!deptMap.has('other')) deptMap.set('other', []);

        this.shoppingList.forEach(item => {
            const deptId = assignDepartment(item);
            (deptMap.get(deptId) || deptMap.get('other')).push(item);
        });

        const lines = [];
        for (const deptId of this.departmentOrder) {
            const items = deptMap.get(deptId);
            if (!items || items.length === 0) continue;
            const dept = deptLookup[deptId];
            lines.push({ header: `${dept.emoji} ${dept.name}` });
            items.forEach(item => lines.push({
                text: `${item.amount} ${item.unit} ${item.name}`,
                checked: item.checked
            }));
        }
        return lines;
    },

    copyToClipboard() {
        const lines = this._formatListGrouped();
        const text = lines.map(l => l.header ? `\n${l.header}` : `  ${l.text}`).join('\n').trim();

        navigator.clipboard.writeText(text).then(() => {
            Toast.success('In Zwischenablage kopiert ✓');
        });
    },

    exportToFile() {
        const lines = this._formatListGrouped();
        const text = lines.map(l => {
            if (l.header) return `\n${l.header}`;
            const checkbox = l.checked ? '[✓]' : '[ ]';
            return `  ${checkbox} ${l.text}`;
        }).join('\n').trim();

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
            this.optimizationResult = await api.post(`${API_BASE_URL}/shopping/optimize`, {
                    shoppingList: this.shoppingList.map(item => ({
                        name: item.name,
                        amount: item.amount,
                        unit: item.unit,
                        category: item.category
                    })),
                    budget: this.budgetAmount,
                    preferences: this.preferences
                });
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
            await api.post(`${API_BASE_URL}/shopping/substitutions`, {
                    originalIngredient: original,
                    substituteIngredient: substitute,
                    reason: reason,
                    savingsPercent: savingsPercent
                });

            Toast.success(`Substitution "${original} → ${substitute}" gespeichert`);
        } catch (error) {
            console.error('Save substitution error:', error);
            Toast.error('Fehler beim Speichern der Substitution');
        }
    },

    async saveBudget() {
        const weekStart = DateUtils.getMonday(new Date()).toISOString().split('T')[0];

        try {
            await api.post(`${API_BASE_URL}/shopping/budget`, {
                    weekStart: weekStart,
                    budgetAmount: this.budgetAmount
                });
        } catch (error) {
            console.error('Save budget error:', error);
        }
    },

    async loadBudget() {
        const weekStart = DateUtils.getMonday(new Date()).toISOString().split('T')[0];

        try {
            const budget = await api.get(`${API_BASE_URL}/shopping/budget/${weekStart}`);
            if (budget && budget.budget_amount) {
                this.budgetAmount = parseFloat(budget.budget_amount);
            }
        } catch (error) {
            console.error('Load budget error:', error);
        }
    }
};

// Pantry View
