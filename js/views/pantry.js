import { AppState } from '../core/app-state.js';
import { StorageService } from '../core/storage-service.js';
import { Toast } from '../core/toast.js';
import { escapeHtml } from '../core/utils.js';
import { App } from '../app.js';

export const PantryView = {
    editingItem: null, // item being edited, or null if adding new
    showForm: false,
    filterCategory: '',
    filterLocation: '',

    // Categories and locations used throughout
    categories: [
        'Gemüse', 'Obst', 'Fleisch & Fisch', 'Milchprodukte', 'Eier',
        'Brot & Backwaren', 'Hülsenfrüchte', 'Getreide & Pasta', 'Konserven',
        'Gewürze & Öle', 'Getränke', 'Süßes & Snacks', 'Tiefkühlkost', 'Sonstiges'
    ],
    locations: ['Kühlschrank', 'Tiefkühler', 'Vorratsschrank', 'Keller', 'Sonstiges'],

    render() {
        const items = AppState.pantryItems;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Apply filters
        const filtered = items.filter(item => {
            if (this.filterCategory && item.category !== this.filterCategory) return false;
            if (this.filterLocation && item.location !== this.filterLocation) return false;
            return true;
        });

        // Sort: expiring soon first (with date), then no date alphabetically
        const withDate = filtered.filter(i => i.expiry_date).sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date));
        const withoutDate = filtered.filter(i => !i.expiry_date).sort((a, b) => a.name.localeCompare(b.name, 'de'));
        const sorted = [...withDate, ...withoutDate];

        // Count expiring within 3 days
        const expiringCount = items.filter(i => {
            if (!i.expiry_date) return false;
            const diff = (new Date(i.expiry_date) - today) / 86400000;
            return diff <= 3 && diff >= 0;
        }).length;

        const expiredCount = items.filter(i => {
            if (!i.expiry_date) return false;
            return new Date(i.expiry_date) < today;
        }).length;

        return `
            <div class="space-y-4">
                <!-- Header -->
                <div class="flex justify-between items-center flex-wrap gap-3">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Speisekammer</h2>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Vorhandene Lebensmittel verwalten</p>
                    </div>
                    <button id="pantry-add-btn" class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                        Hinzufügen
                    </button>
                </div>

                ${(expiringCount > 0 || expiredCount > 0) ? `
                    <div class="flex flex-wrap gap-2">
                        ${expiredCount > 0 ? `
                            <div class="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"></path>
                                </svg>
                                ${expiredCount} abgelaufen
                            </div>
                        ` : ''}
                        ${expiringCount > 0 ? `
                            <div class="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                ${expiringCount} läuft bald ab
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <!-- Add / Edit Form -->
                ${this.showForm ? this.renderForm() : ''}

                <!-- Filters -->
                ${items.length > 0 ? `
                    <div class="flex flex-wrap gap-2">
                        <select id="pantry-filter-category" class="px-3 py-1.5 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white">
                            <option value="">Alle Kategorien</option>
                            ${this.categories.map(c => `<option value="${c}" ${this.filterCategory === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                        <select id="pantry-filter-location" class="px-3 py-1.5 text-sm border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white">
                            <option value="">Alle Orte</option>
                            ${this.locations.map(l => `<option value="${l}" ${this.filterLocation === l ? 'selected' : ''}>${l}</option>`).join('')}
                        </select>
                        ${(this.filterCategory || this.filterLocation) ? `
                            <button id="pantry-clear-filters" class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                Filter zurücksetzen
                            </button>
                        ` : ''}
                    </div>
                ` : ''}

                <!-- Item List -->
                ${sorted.length === 0 && !this.showForm ? `
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-10 text-center">
                        <svg class="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
                        </svg>
                        <p class="text-gray-500 dark:text-gray-400 font-medium">Keine Lebensmittel vorhanden</p>
                        <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Füge Lebensmittel hinzu, um deinen Vorrat zu verwalten.</p>
                    </div>
                ` : sorted.length > 0 ? `
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 divide-y dark:divide-gray-700">
                        ${sorted.map(item => this.renderItem(item, today)).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderItem(item, today) {
        let expiryClass = 'text-gray-500 dark:text-gray-400';
        let expiryLabel = '';
        let rowHighlight = '';

        if (item.expiry_date) {
            const expiryDate = new Date(item.expiry_date);
            const diffDays = Math.round((expiryDate - today) / 86400000);
            const dateStr = expiryDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

            if (diffDays < 0) {
                expiryClass = 'text-red-600 dark:text-red-400 font-medium';
                expiryLabel = `Abgelaufen (${dateStr})`;
                rowHighlight = 'bg-red-50/50 dark:bg-red-900/10';
            } else if (diffDays === 0) {
                expiryClass = 'text-red-600 dark:text-red-400 font-medium';
                expiryLabel = `Heute ablaufend`;
                rowHighlight = 'bg-red-50/50 dark:bg-red-900/10';
            } else if (diffDays <= 3) {
                expiryClass = 'text-amber-600 dark:text-amber-400 font-medium';
                expiryLabel = `Läuft ab in ${diffDays} Tag${diffDays === 1 ? '' : 'en'} (${dateStr})`;
                rowHighlight = 'bg-amber-50/30 dark:bg-amber-900/10';
            } else {
                expiryLabel = `MHD: ${dateStr}`;
            }
        }

        const quantityStr = item.quantity != null
            ? `${parseFloat(item.quantity).toLocaleString('de-DE')}${item.unit ? ' ' + item.unit : ''}`
            : item.unit || '';

        return `
            <div class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${rowHighlight}" data-id="${item.id}">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-medium text-gray-800 dark:text-white">${this.escapeHtml(item.name)}</span>
                        ${item.category ? `<span class="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">${this.escapeHtml(item.category)}</span>` : ''}
                        ${item.location ? `<span class="text-xs px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">${this.escapeHtml(item.location)}</span>` : ''}
                    </div>
                    <div class="flex items-center gap-3 mt-0.5 flex-wrap">
                        ${quantityStr ? `<span class="text-sm text-gray-600 dark:text-gray-300">${this.escapeHtml(quantityStr)}</span>` : ''}
                        ${expiryLabel ? `<span class="text-xs ${expiryClass}">${expiryLabel}</span>` : ''}
                        ${item.notes ? `<span class="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">${this.escapeHtml(item.notes)}</span>` : ''}
                    </div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                    <button class="pantry-edit-btn p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors" data-id="${item.id}" title="Bearbeiten">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button class="pantry-delete-btn p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors" data-id="${item.id}" title="Löschen">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    },

    renderForm() {
        const item = this.editingItem || {};
        const isEdit = !!item.id;
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-5">
                <h3 class="font-semibold text-gray-800 dark:text-white mb-4">${isEdit ? 'Lebensmittel bearbeiten' : 'Neues Lebensmittel'}</h3>
                <form id="pantry-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="sm:col-span-2">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                        <input type="text" id="pantry-name" value="${this.escapeHtml(item.name || '')}"
                            class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="z.B. Karotten" required autocomplete="off">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Menge</label>
                        <input type="number" id="pantry-quantity" value="${item.quantity != null ? parseFloat(item.quantity) : ''}" min="0" step="any"
                            class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="z.B. 500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Einheit</label>
                        <input type="text" id="pantry-unit" value="${this.escapeHtml(item.unit || '')}"
                            class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="z.B. g, ml, Stück" list="pantry-unit-list">
                        <datalist id="pantry-unit-list">
                            <option value="g"><option value="kg"><option value="ml"><option value="l">
                            <option value="Stück"><option value="Packung"><option value="Dose"><option value="Flasche">
                            <option value="Bund"><option value="EL"><option value="TL">
                        </datalist>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategorie</label>
                        <select id="pantry-category" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            <option value="">-- Keine --</option>
                            ${this.categories.map(c => `<option value="${c}" ${item.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lagerort</label>
                        <select id="pantry-location" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                            <option value="">-- Keiner --</option>
                            ${this.locations.map(l => `<option value="${l}" ${item.location === l ? 'selected' : ''}>${l}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kaufdatum</label>
                        <input type="date" id="pantry-purchase-date" value="${item.purchase_date ? item.purchase_date.split('T')[0] : ''}"
                            class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mindesthaltbarkeitsdatum</label>
                        <input type="date" id="pantry-expiry-date" value="${item.expiry_date ? item.expiry_date.split('T')[0] : ''}"
                            class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notizen</label>
                        <input type="text" id="pantry-notes" value="${this.escapeHtml(item.notes || '')}"
                            class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Optional">
                    </div>
                    <div class="sm:col-span-2 flex gap-2 justify-end">
                        <button type="button" id="pantry-form-cancel" class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm">
                            Abbrechen
                        </button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm">
                            ${isEdit ? 'Speichern' : 'Hinzufügen'}
                        </button>
                    </div>
                </form>
            </div>
        `;
    },

    attachEventListeners() {
        // Add button
        const addBtn = document.getElementById('pantry-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.editingItem = null;
                this.showForm = true;
                App.render();
                // Scroll to and focus form
                setTimeout(() => {
                    const form = document.getElementById('pantry-form');
                    if (form) {
                        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        const nameInput = document.getElementById('pantry-name');
                        if (nameInput) nameInput.focus();
                    }
                }, 50);
            });
        }

        // Cancel form
        const cancelBtn = document.getElementById('pantry-form-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.showForm = false;
                this.editingItem = null;
                App.render();
            });
        }

        // Submit form
        const form = document.getElementById('pantry-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveItem();
            });
        }

        // Edit buttons
        document.querySelectorAll('.pantry-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                this.editingItem = AppState.pantryItems.find(i => i.id === id) || null;
                this.showForm = true;
                App.render();
                setTimeout(() => {
                    const form = document.getElementById('pantry-form');
                    if (form) {
                        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        const nameInput = document.getElementById('pantry-name');
                        if (nameInput) nameInput.focus();
                    }
                }, 50);
            });
        });

        // Delete buttons
        document.querySelectorAll('.pantry-delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const item = AppState.pantryItems.find(i => i.id === id);
                if (!item) return;
                if (!confirm(`"${item.name}" wirklich löschen?`)) return;
                try {
                    await StorageService.deletePantryItem(id);
                    AppState.pantryItems = AppState.pantryItems.filter(i => i.id !== id);
                    Toast.success('Lebensmittel gelöscht');
                    App.render();
                } catch (err) {
                    Toast.error('Fehler beim Löschen');
                }
            });
        });

        // Category filter
        const catFilter = document.getElementById('pantry-filter-category');
        if (catFilter) {
            catFilter.addEventListener('change', () => {
                this.filterCategory = catFilter.value;
                App.render();
            });
        }

        // Location filter
        const locFilter = document.getElementById('pantry-filter-location');
        if (locFilter) {
            locFilter.addEventListener('change', () => {
                this.filterLocation = locFilter.value;
                App.render();
            });
        }

        // Clear filters
        const clearBtn = document.getElementById('pantry-clear-filters');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.filterCategory = '';
                this.filterLocation = '';
                App.render();
            });
        }
    },

    async saveItem() {
        const name = document.getElementById('pantry-name')?.value?.trim();
        if (!name) {
            Toast.error('Name ist erforderlich');
            return;
        }

        const payload = {
            name,
            quantity: document.getElementById('pantry-quantity')?.value || null,
            unit: document.getElementById('pantry-unit')?.value?.trim() || null,
            category: document.getElementById('pantry-category')?.value || null,
            location: document.getElementById('pantry-location')?.value || null,
            purchase_date: document.getElementById('pantry-purchase-date')?.value || null,
            expiry_date: document.getElementById('pantry-expiry-date')?.value || null,
            notes: document.getElementById('pantry-notes')?.value?.trim() || null,
        };

        try {
            if (this.editingItem?.id) {
                payload.id = this.editingItem.id;
                const updated = await StorageService.updatePantryItem(payload);
                AppState.pantryItems = AppState.pantryItems.map(i => i.id === updated.id ? updated : i);
                Toast.success('Lebensmittel aktualisiert');
            } else {
                const created = await StorageService.addPantryItem(payload);
                AppState.pantryItems = [...AppState.pantryItems, created];
                Toast.success('Lebensmittel hinzugefügt');
            }
            this.showForm = false;
            this.editingItem = null;
            App.render();
        } catch (err) {
            Toast.error(err.message || 'Fehler beim Speichern');
        }
    },

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
};
