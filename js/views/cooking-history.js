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
            return '<div class="text-ds-text">Lade Kochverlauf...</div>';
        }

        return `
            <div class="space-y-6">
                <div class="flex justify-between items-center flex-wrap gap-3">
                    <h2 class="ds-page-title">Kochverlauf</h2>
                    <div class="flex gap-2">
                        <select id="history-filter" class="ds-input px-3 py-2">
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
                <div class="ds-card p-8 text-center">
                    <p class="text-ds-text-muted">Noch keine Einträge im Kochverlauf.</p>
                    <p class="text-sm text-ds-text-muted mt-2">
                        Markiere Rezepte im Wochenplan als "Gekocht", um sie hier zu sehen.
                    </p>
                </div>
            `;
        }

        return `
            <div class="ds-card">
                <div class="p-4 border-b border-ds-border">
                    <h3 class="font-semibold text-ds-text">
                        ${total} Einträge insgesamt
                    </h3>
                </div>
                <div class="divide-y divide-ds-border">
                    ${history.map(entry => `
                        <div class="p-4 flex justify-between items-center hover:bg-ds-bg-muted transition-colors">
                            <div>
                                <p class="font-medium text-ds-text">${this.escapeHtml(entry.recipe_name)}</p>
                                <p class="text-sm text-ds-text-muted">
                                    ${this.formatDate(entry.cooked_at)}
                                    ${entry.servings ? ` • ${entry.servings} Portionen` : ''}
                                </p>
                                ${entry.notes ? `<p class="text-sm text-ds-text-body mt-1">${this.escapeHtml(entry.notes)}</p>` : ''}
                            </div>
                            <button class="delete-history-btn text-ds-danger hover:text-ds-danger p-2"
                                    data-id="${entry.id}" title="Eintrag löschen">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                            </button>
                        </div>
                    `).join('')}
                </div>
                ${totalPages > 1 ? `
                    <div class="p-4 border-t border-ds-border flex justify-center gap-2">
                        <button id="prev-page-btn" class="ds-btn ds-btn-secondary"
                                ${page <= 1 ? 'disabled' : ''}>
                            Zurück
                        </button>
                        <span class="px-4 py-2 text-ds-text-sec">
                            Seite ${page} von ${totalPages}
                        </span>
                        <button id="next-page-btn" class="ds-btn ds-btn-secondary"
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
            return '<div class="text-ds-text-muted">Lade Daten...</div>';
        }

        if (this.notCookedData.length === 0) {
            return `
                <div class="ds-card p-8 text-center">
                    <p class="text-ds-text-muted">
                        Alle Rezepte wurden in den letzten ${this.filterDays} Tagen gekocht!
                    </p>
                </div>
            `;
        }

        return `
            <div class="ds-card">
                <div class="p-4 border-b border-ds-border">
                    <h3 class="font-semibold text-ds-text">
                        ${this.notCookedData.length} Rezepte seit ${this.filterDays}+ Tagen nicht gekocht
                    </h3>
                </div>
                <div class="divide-y divide-ds-border">
                    ${this.notCookedData.map(recipe => `
                        <div class="p-4 flex justify-between items-center hover:bg-ds-bg-muted transition-colors">
                            <div>
                                <p class="font-medium text-ds-text">${this.escapeHtml(recipe.recipe_name)}</p>
                                <p class="text-sm text-ds-text-muted">
                                    ${recipe.last_cooked_at
                                        ? `Zuletzt gekocht: ${this.formatDate(recipe.last_cooked_at)} (${Math.round(recipe.days_since_last_cooked)} Tage her)`
                                        : 'Noch nie gekocht'}
                                </p>
                            </div>
                            <button class="quick-cook-btn ds-btn ds-btn-primary ds-btn-sm"
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
            <div class="ds-card mt-6">
                <div class="p-4 border-b border-ds-border">
                    <h3 class="font-semibold text-ds-text">Top 5 häufig gekochte Rezepte</h3>
                </div>
                <div class="divide-y divide-ds-border">
                    ${topRecipes.map((stat, index) => `
                        <div class="p-4 flex justify-between items-center">
                            <div class="flex items-center gap-3">
                                <span class="w-8 h-8 flex items-center justify-center rounded-full bg-ds-accent-bg text-ds-accent font-bold text-sm">
                                    ${index + 1}
                                </span>
                                <div>
                                    <p class="font-medium text-ds-text">${this.escapeHtml(stat.recipe_name)}</p>
                                    <p class="text-sm text-ds-text-muted">
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
