import { AppState } from '../core/app-state.js';
import { StorageService } from '../core/storage-service.js';
import { Toast } from '../core/toast.js';
import { App } from '../app.js';

export const CookingHistoryView = {
    currentPage: 1,
    historyData: null,
    statsData: null,
    filterDays: 0, // 0 = all, 30 = last 30 days not cooked

    async loadData() {
        const [history, stats] = await Promise.all([
            StorageService.getCookingHistory(this.currentPage),
            StorageService.getCookingStats()
        ]);
        this.historyData = history;
        this.statsData = stats;
    },

    render() {
        if (!this.historyData) {
            this.loadData().then(() => App.render());
            return '<div class="text-gray-800 dark:text-gray-200">Lade Kochverlauf...</div>';
        }

        return `
            <div class="space-y-6">
                <div class="flex justify-between items-center flex-wrap gap-3">
                    <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Kochverlauf</h2>
                    <div class="flex gap-2">
                        <select id="history-filter" class="px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white">
                            <option value="0" ${this.filterDays === 0 ? 'selected' : ''}>Alle Rezepte</option>
                            <option value="30" ${this.filterDays === 30 ? 'selected' : ''}>Lange nicht gekocht (30+ Tage)</option>
                            <option value="60" ${this.filterDays === 60 ? 'selected' : ''}>Lange nicht gekocht (60+ Tage)</option>
                            <option value="90" ${this.filterDays === 90 ? 'selected' : ''}>Lange nicht gekocht (90+ Tage)</option>
                        </select>
                    </div>
                </div>

                ${this.filterDays > 0 ? this.renderNotCookedRecently() : this.renderHistory()}
            </div>
        `;
    },

    renderHistory() {
        const { history, total, page, totalPages } = this.historyData;

        if (history.length === 0) {
            return `
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                    <p class="text-gray-500 dark:text-gray-400">Noch keine Einträge im Kochverlauf.</p>
                    <p class="text-sm text-gray-400 dark:text-gray-500 mt-2">
                        Markiere Rezepte im Wochenplan als "Gekocht", um sie hier zu sehen.
                    </p>
                </div>
            `;
        }

        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900">
                <div class="p-4 border-b dark:border-gray-700">
                    <h3 class="font-semibold text-gray-800 dark:text-white">
                        ${total} Einträge insgesamt
                    </h3>
                </div>
                <div class="divide-y dark:divide-gray-700">
                    ${history.map(entry => `
                        <div class="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <div>
                                <p class="font-medium text-gray-800 dark:text-white">${this.escapeHtml(entry.recipe_name)}</p>
                                <p class="text-sm text-gray-500 dark:text-gray-400">
                                    ${this.formatDate(entry.cooked_at)}
                                    ${entry.servings ? ` • ${entry.servings} Portionen` : ''}
                                </p>
                                ${entry.notes ? `<p class="text-sm text-gray-600 dark:text-gray-300 mt-1">${this.escapeHtml(entry.notes)}</p>` : ''}
                            </div>
                            <button class="delete-history-btn text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-600 p-2"
                                    data-id="${entry.id}" title="Eintrag löschen">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                            </button>
                        </div>
                    `).join('')}
                </div>
                ${totalPages > 1 ? `
                    <div class="p-4 border-t dark:border-gray-700 flex justify-center gap-2">
                        <button id="prev-page-btn" class="px-4 py-2 border dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300"
                                ${page <= 1 ? 'disabled' : ''}>
                            Zurück
                        </button>
                        <span class="px-4 py-2 text-gray-600 dark:text-gray-400">
                            Seite ${page} von ${totalPages}
                        </span>
                        <button id="next-page-btn" class="px-4 py-2 border dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300"
                                ${page >= totalPages ? 'disabled' : ''}>
                            Weiter
                        </button>
                    </div>
                ` : ''}
            </div>

            ${this.renderStats()}
        `;
    },

    renderNotCookedRecently() {
        if (!this.notCookedData) {
            StorageService.getNotCookedRecently(this.filterDays).then(data => {
                this.notCookedData = data;
                App.render();
            });
            return '<div class="text-gray-500 dark:text-gray-400">Lade Daten...</div>';
        }

        if (this.notCookedData.length === 0) {
            return `
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
                    <p class="text-gray-500 dark:text-gray-400">
                        Alle Rezepte wurden in den letzten ${this.filterDays} Tagen gekocht!
                    </p>
                </div>
            `;
        }

        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900">
                <div class="p-4 border-b dark:border-gray-700">
                    <h3 class="font-semibold text-gray-800 dark:text-white">
                        ${this.notCookedData.length} Rezepte seit ${this.filterDays}+ Tagen nicht gekocht
                    </h3>
                </div>
                <div class="divide-y dark:divide-gray-700">
                    ${this.notCookedData.map(recipe => `
                        <div class="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <div>
                                <p class="font-medium text-gray-800 dark:text-white">${this.escapeHtml(recipe.recipe_name)}</p>
                                <p class="text-sm text-gray-500 dark:text-gray-400">
                                    ${recipe.last_cooked_at
                                        ? `Zuletzt gekocht: ${this.formatDate(recipe.last_cooked_at)} (${Math.round(recipe.days_since_last_cooked)} Tage her)`
                                        : 'Noch nie gekocht'}
                                </p>
                            </div>
                            <button class="quick-cook-btn px-3 py-1 bg-green-500 dark:bg-green-600 text-white text-sm rounded hover:bg-green-600 dark:hover:bg-green-700 transition-colors"
                                    data-recipe-id="${recipe.recipe_id}"
                                    data-recipe-name="${this.escapeHtml(recipe.recipe_name)}">
                                Jetzt kochen
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderStats() {
        if (!this.statsData || this.statsData.length === 0) {
            return '';
        }

        const topRecipes = this.statsData.slice(0, 5);

        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 mt-6">
                <div class="p-4 border-b dark:border-gray-700">
                    <h3 class="font-semibold text-gray-800 dark:text-white">Top 5 häufig gekochte Rezepte</h3>
                </div>
                <div class="divide-y dark:divide-gray-700">
                    ${topRecipes.map((stat, index) => `
                        <div class="p-4 flex justify-between items-center">
                            <div class="flex items-center gap-3">
                                <span class="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-bold text-sm">
                                    ${index + 1}
                                </span>
                                <div>
                                    <p class="font-medium text-gray-800 dark:text-white">${this.escapeHtml(stat.recipe_name)}</p>
                                    <p class="text-sm text-gray-500 dark:text-gray-400">
                                        ${stat.times_cooked}x gekocht
                                        ${stat.last_cooked_at ? ` • Zuletzt: ${this.formatDate(stat.last_cooked_at)}` : ''}
                                    </p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    attachEventListeners() {
        // Filter select
        const filterSelect = document.getElementById('history-filter');
        if (filterSelect) {
            filterSelect.addEventListener('change', async (e) => {
                this.filterDays = parseInt(e.target.value);
                this.notCookedData = null; // Reset to reload
                App.render();
            });
        }

        // Delete history entry buttons
        document.querySelectorAll('.delete-history-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                if (confirm('Eintrag wirklich löschen?')) {
                    try {
                        await StorageService.deleteCookingHistoryEntry(id);
                        this.historyData = null; // Reset to reload
                        App.render();
                        Toast.success('Eintrag gelöscht');
                    } catch (error) {
                        Toast.error('Fehler beim Löschen');
                    }
                }
            });
        });

        // Pagination buttons
        const prevBtn = document.getElementById('prev-page-btn');
        if (prevBtn) {
            prevBtn.addEventListener('click', async () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.historyData = null;
                    App.render();
                }
            });
        }

        const nextBtn = document.getElementById('next-page-btn');
        if (nextBtn) {
            nextBtn.addEventListener('click', async () => {
                if (this.historyData && this.currentPage < this.historyData.totalPages) {
                    this.currentPage++;
                    this.historyData = null;
                    App.render();
                }
            });
        }

        // Quick cook buttons
        document.querySelectorAll('.quick-cook-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const recipeId = e.currentTarget.dataset.recipeId;
                const recipeName = e.currentTarget.dataset.recipeName;
                try {
                    await StorageService.markAsCooked(recipeId);
                    this.historyData = null;
                    this.statsData = null;
                    this.notCookedData = null;
                    App.render();
                    Toast.success(`"${recipeName}" als gekocht markiert`);
                } catch (error) {
                    Toast.error('Fehler beim Markieren als gekocht');
                }
            });
        });
    }
};

// Week Planner View
