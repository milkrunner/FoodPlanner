// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : '/api';

// PWA & Offline Support
const PWA = {
    isOnline: navigator.onLine,
    deferredPrompt: null,
    swRegistration: null,

    async init() {
        // Register Service Worker
        if ('serviceWorker' in navigator) {
            try {
                this.swRegistration = await navigator.serviceWorker.register('/sw.js');
                console.log('[PWA] Service Worker registered');

                // Check for updates
                this.swRegistration.addEventListener('updatefound', () => {
                    const newWorker = this.swRegistration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            Toast.show('Neue Version verfügbar. Seite neu laden für Updates.', {
                                type: 'default',
                                duration: 10000
                            });
                        }
                    });
                });
            } catch (error) {
                console.error('[PWA] Service Worker registration failed:', error);
            }
        }

        // Listen for online/offline events
        window.addEventListener('online', () => this.handleOnlineStatus(true));
        window.addEventListener('offline', () => this.handleOnlineStatus(false));

        // Handle install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        // Track successful installation
        window.addEventListener('appinstalled', () => {
            console.log('[PWA] App installed');
            this.deferredPrompt = null;
            this.hideInstallButton();
        });

        // Initialize IndexedDB
        await OfflineDB.init();

        // Update offline indicator
        this.updateOfflineIndicator();
    },

    handleOnlineStatus(online) {
        this.isOnline = online;
        this.updateOfflineIndicator();

        if (online) {
            Toast.show('Wieder online', { type: 'success', duration: 2000 });
            // Sync pending data
            this.syncPendingData();
        } else {
            Toast.show('Offline-Modus aktiv', { type: 'default', duration: 3000 });
        }
    },

    updateOfflineIndicator() {
        let indicator = document.getElementById('offline-indicator');

        if (!this.isOnline) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'offline-indicator';
                indicator.className = 'fixed top-0 left-0 right-0 bg-yellow-500 text-yellow-900 text-center py-1 text-sm font-medium z-50';
                indicator.textContent = 'Offline - Daten werden lokal gespeichert';
                document.body.prepend(indicator);
            }
        } else if (indicator) {
            indicator.remove();
        }
    },

    showInstallButton() {
        // Will be rendered in the UI
        const existingBtn = document.getElementById('pwa-install-btn');
        if (existingBtn) existingBtn.classList.remove('hidden');
    },

    hideInstallButton() {
        const btn = document.getElementById('pwa-install-btn');
        if (btn) btn.classList.add('hidden');
    },

    async promptInstall() {
        if (!this.deferredPrompt) return;

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log('[PWA] Install prompt outcome:', outcome);
        this.deferredPrompt = null;
    },

    async syncPendingData() {
        if (!this.isOnline) return;

        // Request background sync if available
        if (this.swRegistration && 'sync' in this.swRegistration) {
            try {
                await this.swRegistration.sync.register('sync-recipes');
                await this.swRegistration.sync.register('sync-weekplan');
                await this.swRegistration.sync.register('sync-shopping');
            } catch (error) {
                console.error('[PWA] Background sync failed:', error);
                // Fallback to manual sync
                await this.manualSync();
            }
        } else {
            await this.manualSync();
        }
    },

    async manualSync() {
        try {
            const pendingRecipes = await OfflineDB.getPending('recipes');
            for (const item of pendingRecipes) {
                try {
                    await fetch(`${API_BASE_URL}/recipes`, {
                        method: item.method || 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(item.data)
                    });
                    await OfflineDB.removePending('recipes', item.id);
                } catch (e) {
                    console.error('[PWA] Failed to sync recipe:', e);
                }
            }

            const pendingWeekplans = await OfflineDB.getPending('weekplan');
            for (const item of pendingWeekplans) {
                try {
                    await fetch(`${API_BASE_URL}/weekplan`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(item.data)
                    });
                    await OfflineDB.removePending('weekplan', item.id);
                } catch (e) {
                    console.error('[PWA] Failed to sync weekplan:', e);
                }
            }
        } catch (error) {
            console.error('[PWA] Manual sync failed:', error);
        }
    }
};

// IndexedDB for Offline Storage
const OfflineDB = {
    db: null,
    DB_NAME: 'foodplanner-offline',
    DB_VERSION: 1,

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = () => {
                console.error('[OfflineDB] Failed to open database');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('[OfflineDB] Database opened');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Store for cached recipes
                if (!db.objectStoreNames.contains('recipes')) {
                    db.createObjectStore('recipes', { keyPath: 'id' });
                }

                // Store for cached weekplans
                if (!db.objectStoreNames.contains('weekplan')) {
                    db.createObjectStore('weekplan', { keyPath: 'id' });
                }

                // Store for shopping list
                if (!db.objectStoreNames.contains('shopping')) {
                    db.createObjectStore('shopping', { keyPath: 'id' });
                }

                // Store for pending sync operations
                if (!db.objectStoreNames.contains('pending-recipes')) {
                    const store = db.createObjectStore('pending-recipes', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp');
                }

                if (!db.objectStoreNames.contains('pending-weekplan')) {
                    const store = db.createObjectStore('pending-weekplan', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp');
                }

                if (!db.objectStoreNames.contains('pending-shopping')) {
                    const store = db.createObjectStore('pending-shopping', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp');
                }

                console.log('[OfflineDB] Database upgraded');
            };
        });
    },

    async saveRecipes(recipes) {
        if (!this.db) return;
        const transaction = this.db.transaction('recipes', 'readwrite');
        const store = transaction.objectStore('recipes');

        // Clear and save all
        await new Promise((resolve, reject) => {
            const clearRequest = store.clear();
            clearRequest.onsuccess = resolve;
            clearRequest.onerror = reject;
        });

        for (const recipe of recipes) {
            store.put(recipe);
        }

        return new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = reject;
        });
    },

    async getRecipes() {
        if (!this.db) return [];
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction('recipes', 'readonly');
            const store = transaction.objectStore('recipes');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    async saveWeekplan(weekplan) {
        if (!this.db) return;
        const transaction = this.db.transaction('weekplan', 'readwrite');
        const store = transaction.objectStore('weekplan');
        store.put({ ...weekplan, id: weekplan.id || 'current' });
        return new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = reject;
        });
    },

    async getWeekplan(id = 'current') {
        if (!this.db) return null;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction('weekplan', 'readonly');
            const store = transaction.objectStore('weekplan');
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    },

    async addPending(storeName, data, method = 'POST') {
        if (!this.db) return;
        const fullStoreName = `pending-${storeName}`;
        if (!this.db.objectStoreNames.contains(fullStoreName)) return;

        const transaction = this.db.transaction(fullStoreName, 'readwrite');
        const store = transaction.objectStore(fullStoreName);
        store.add({
            data,
            method,
            timestamp: Date.now()
        });
        return new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = reject;
        });
    },

    async getPending(storeName) {
        if (!this.db) return [];
        const fullStoreName = `pending-${storeName}`;
        if (!this.db.objectStoreNames.contains(fullStoreName)) return [];

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(fullStoreName, 'readonly');
            const store = transaction.objectStore(fullStoreName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    async removePending(storeName, id) {
        if (!this.db) return;
        const fullStoreName = `pending-${storeName}`;
        if (!this.db.objectStoreNames.contains(fullStoreName)) return;

        const transaction = this.db.transaction(fullStoreName, 'readwrite');
        const store = transaction.objectStore(fullStoreName);
        store.delete(id);
        return new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = reject;
        });
    }
};

// HTML escape utility to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Toast Notification Manager
const Toast = {
    show(message, options = {}) {
        const {
            duration = options.showUndo ? 10000 : 3000,
            showUndo = false,
            onUndo = null,
            type = 'default' // 'default', 'success', 'error'
        } = options;

        // Remove existing toast
        const existingToast = document.getElementById('toast-notification');
        if (existingToast) existingToast.remove();

        // Determine background color based on type
        let bgColor = 'bg-gray-800 dark:bg-gray-700';
        if (type === 'success') bgColor = 'bg-green-600 dark:bg-green-700';
        if (type === 'error') bgColor = 'bg-red-600 dark:bg-red-700';

        // Create toast with ARIA live region for accessibility
        const toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-4 z-50 animate-slide-up`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        toast.setAttribute('aria-atomic', 'true');

        // Create message span with safe text content
        const messageSpan = document.createElement('span');
        messageSpan.className = 'flex-1';
        messageSpan.textContent = message;
        toast.appendChild(messageSpan);

        // Add undo button if needed
        if (showUndo) {
            const undoBtn = document.createElement('button');
            undoBtn.id = 'toast-undo-btn';
            undoBtn.className = 'px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors font-medium';
            undoBtn.textContent = 'Rückgängig';
            toast.appendChild(undoBtn);
        }

        // Add close button
        const closeBtnEl = document.createElement('button');
        closeBtnEl.id = 'toast-close-btn';
        closeBtnEl.className = 'text-gray-200 hover:text-white text-xl';
        closeBtnEl.textContent = '✕';
        toast.appendChild(closeBtnEl);

        document.body.appendChild(toast);

        // Attach event listeners
        const close = () => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 200);
        };

        closeBtnEl.addEventListener('click', close);

        if (showUndo && onUndo) {
            const undoBtnEl = toast.querySelector('#toast-undo-btn');
            if (undoBtnEl) {
                undoBtnEl.addEventListener('click', () => {
                    onUndo();
                    close();
                });
            }
        }

        // Auto close after duration
        setTimeout(close, duration);
    },

    success(message) {
        this.show(message, { type: 'success' });
    },

    error(message) {
        this.show(message, { type: 'error' });
    }
};

// Action History Manager
const ActionHistory = {
    history: [],
    maxHistory: 10,

    addAction(action) {
        this.history.unshift(action);
        if (this.history.length > this.maxHistory) {
            this.history.pop();
        }
    },

    undo() {
        if (this.history.length === 0) return;

        const action = this.history.shift();
        if (action && action.undo) {
            action.undo();
            Toast.show(action.undoMessage || 'Aktion rückgängig gemacht');
        }
    },

    clear() {
        this.history = [];
    }
};

// Onboarding Tour Manager
const OnboardingManager = {
    STORAGE_KEY: 'foodplanner_onboarding',
    currentStep: 0,
    isActive: false,

    steps: [
        {
            target: null, // Welcome modal, no target
            title: 'Willkommen beim FoodPlanner!',
            content: 'Entdecke, wie du deine Mahlzeiten einfach planen kannst. Diese kurze Tour zeigt dir die wichtigsten Funktionen.',
            position: 'center'
        },
        {
            target: '[data-nav="planner"]',
            title: 'Wochenplaner',
            content: 'Plane deine Mahlzeiten für die ganze Woche. Ziehe Rezepte einfach in die gewünschten Tage oder lass dir von der KI einen Plan erstellen.',
            position: 'bottom'
        },
        {
            target: '[data-nav="recipes"]',
            title: 'Rezeptsammlung',
            content: 'Hier findest du alle deine Rezepte. Du kannst neue hinzufügen, suchen und nach Zeit, Schwierigkeit oder Saison filtern.',
            position: 'bottom'
        },
        {
            target: '[data-nav="shopping"]',
            title: 'Einkaufsliste',
            content: 'Die Einkaufsliste wird automatisch aus deinem Wochenplan erstellt. Praktisch beim Einkaufen!',
            position: 'bottom'
        },
        {
            target: null,
            title: 'Bereit zum Starten!',
            content: 'Du kennst jetzt die Grundlagen. Erstelle dein erstes Rezept oder erkunde die App auf eigene Faust. Tipp: Mit Strg+Z kannst du Aktionen rückgängig machen!',
            position: 'center'
        }
    ],

    init() {
        const status = this.getStatus();
        if (!status.completed && !status.skipped) {
            // First visit - show onboarding after a short delay
            setTimeout(() => this.start(), 500);
        }
    },

    getStatus() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : { completed: false, skipped: false };
        } catch {
            return { completed: false, skipped: false };
        }
    },

    saveStatus(status) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(status));
        } catch (e) {
            console.warn('Could not save onboarding status:', e);
        }
    },

    start() {
        this.currentStep = 0;
        this.isActive = true;
        this.showStep();
    },

    restart() {
        this.saveStatus({ completed: false, skipped: false });
        this.start();
    },

    showStep() {
        // Remove existing overlay
        this.removeOverlay();

        const step = this.steps[this.currentStep];
        if (!step) {
            this.complete();
            return;
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'onboarding-overlay';
        overlay.className = 'fixed inset-0 z-[9999] transition-opacity';
        overlay.innerHTML = `
            <div class="absolute inset-0 bg-black/60"></div>
            <div id="onboarding-spotlight" class="absolute rounded-lg transition-all duration-300" style="box-shadow: 0 0 0 9999px rgba(0,0,0,0.6);"></div>
            <div id="onboarding-tooltip" class="absolute bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm z-10 transform transition-all duration-300">
                <div class="flex items-center justify-between mb-3">
                    <h3 class="text-lg font-bold text-gray-800 dark:text-white">${step.title}</h3>
                    <span class="text-sm text-gray-500 dark:text-gray-400">${this.currentStep + 1}/${this.steps.length}</span>
                </div>
                <p class="text-gray-600 dark:text-gray-300 mb-6">${step.content}</p>
                <div class="flex items-center justify-between">
                    <button id="onboarding-skip" class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                        Tour überspringen
                    </button>
                    <div class="flex gap-2">
                        ${this.currentStep > 0 ? `
                            <button id="onboarding-prev" class="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                Zurück
                            </button>
                        ` : ''}
                        <button id="onboarding-next" class="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                            ${this.currentStep === this.steps.length - 1 ? 'Fertig' : 'Weiter'}
                        </button>
                    </div>
                </div>
                <div class="flex justify-center gap-1 mt-4">
                    ${this.steps.map((_, i) => `
                        <div class="w-2 h-2 rounded-full transition-colors ${i === this.currentStep ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}"></div>
                    `).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Position elements
        this.positionTooltip(step);

        // Attach event listeners
        document.getElementById('onboarding-skip')?.addEventListener('click', () => this.skip());
        document.getElementById('onboarding-prev')?.addEventListener('click', () => this.prev());
        document.getElementById('onboarding-next')?.addEventListener('click', () => this.next());

        // Close on escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.skip();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    },

    positionTooltip(step) {
        const tooltip = document.getElementById('onboarding-tooltip');
        const spotlight = document.getElementById('onboarding-spotlight');
        if (!tooltip || !spotlight) return;

        if (!step.target || step.position === 'center') {
            // Center the tooltip
            tooltip.style.top = '50%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translate(-50%, -50%)';
            spotlight.style.display = 'none';
            return;
        }

        const targetEl = document.querySelector(step.target);
        if (!targetEl) {
            // Target not found, center the tooltip
            tooltip.style.top = '50%';
            tooltip.style.left = '50%';
            tooltip.style.transform = 'translate(-50%, -50%)';
            spotlight.style.display = 'none';
            return;
        }

        const rect = targetEl.getBoundingClientRect();
        const padding = 8;

        // Position spotlight around target
        spotlight.style.display = 'block';
        spotlight.style.top = `${rect.top - padding}px`;
        spotlight.style.left = `${rect.left - padding}px`;
        spotlight.style.width = `${rect.width + padding * 2}px`;
        spotlight.style.height = `${rect.height + padding * 2}px`;
        spotlight.style.boxShadow = '0 0 0 9999px rgba(0,0,0,0.6)';

        // Position tooltip
        const tooltipRect = tooltip.getBoundingClientRect();
        let top, left;

        switch (step.position) {
            case 'bottom':
                top = rect.bottom + 16;
                left = rect.left + rect.width / 2 - tooltipRect.width / 2;
                break;
            case 'top':
                top = rect.top - tooltipRect.height - 16;
                left = rect.left + rect.width / 2 - tooltipRect.width / 2;
                break;
            case 'left':
                top = rect.top + rect.height / 2 - tooltipRect.height / 2;
                left = rect.left - tooltipRect.width - 16;
                break;
            case 'right':
                top = rect.top + rect.height / 2 - tooltipRect.height / 2;
                left = rect.right + 16;
                break;
            default:
                top = rect.bottom + 16;
                left = rect.left;
        }

        // Keep tooltip in viewport
        left = Math.max(16, Math.min(left, window.innerWidth - tooltipRect.width - 16));
        top = Math.max(16, Math.min(top, window.innerHeight - tooltipRect.height - 16));

        tooltip.style.top = `${top}px`;
        tooltip.style.left = `${left}px`;
        tooltip.style.transform = 'none';
    },

    next() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.showStep();
        } else {
            this.complete();
        }
    },

    prev() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showStep();
        }
    },

    skip() {
        this.saveStatus({ completed: false, skipped: true });
        this.removeOverlay();
        this.isActive = false;
        Toast.show('Tour übersprungen. Du kannst sie jederzeit im Menü neu starten.');
    },

    complete() {
        this.saveStatus({ completed: true, skipped: false });
        this.removeOverlay();
        this.isActive = false;
        Toast.success('Tour abgeschlossen! Viel Spaß mit dem FoodPlanner.');
    },

    removeOverlay() {
        const overlay = document.getElementById('onboarding-overlay');
        if (overlay) overlay.remove();
    }
};

// Date Utilities for Calendar View
const DateUtils = {
    // Get Monday of the week containing the given date
    getMonday(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    },

    // Format date as "Montag, 23.12.2024"
    formatDateWithDay(date) {
        const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        const d = new Date(date);
        const dayName = days[d.getDay()];
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${dayName}, ${day}.${month}.${year}`;
    },

    // Format week range as "23.12. - 29.12.2024"
    formatWeekRange(startDate) {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);

        const startDay = start.getDate().toString().padStart(2, '0');
        const startMonth = (start.getMonth() + 1).toString().padStart(2, '0');
        const endDay = end.getDate().toString().padStart(2, '0');
        const endMonth = (end.getMonth() + 1).toString().padStart(2, '0');
        const year = end.getFullYear();

        if (start.getMonth() === end.getMonth()) {
            return `${startDay}. - ${endDay}.${endMonth}.${year}`;
        }
        return `${startDay}.${startMonth}. - ${endDay}.${endMonth}.${year}`;
    },

    // Get week ID from date (format: YYYY-WW)
    getWeekId(date) {
        const d = new Date(date);
        const monday = this.getMonday(d);
        const year = monday.getFullYear();
        const firstDayOfYear = new Date(year, 0, 1);
        const firstMonday = this.getMonday(firstDayOfYear);
        if (firstMonday > firstDayOfYear) {
            firstMonday.setDate(firstMonday.getDate() - 7);
        }
        const weekNumber = Math.ceil(((monday - firstMonday) / 86400000 + 1) / 7);
        return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
    },

    // Check if date is today
    isToday(date) {
        const today = new Date();
        const d = new Date(date);
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    },

    // Check if date is in the past
    isPast(date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d < today;
    }
};

// Dark Mode Manager
const DarkMode = {
    init() {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            this.enable();
        } else {
            this.disable();
        }
    },

    toggle() {
        if (document.documentElement.classList.contains('dark')) {
            this.disable();
        } else {
            this.enable();
        }
    },

    enable() {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    },

    disable() {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        localStorage.setItem('theme', 'light');
    },

    isDark() {
        return document.documentElement.classList.contains('dark');
    }
};

// Storage Service with API integration and offline support
const StorageService = {
    async getRecipes(options = {}) {
        const params = new URLSearchParams();
        const favoritesOnly = options.favorites === true;

        if (options.page) params.set('page', String(options.page));
        if (options.pageSize) params.set('pageSize', String(options.pageSize));
        if (options.all) params.set('all', 'true');
        if (favoritesOnly) params.set('favorites', 'true');

        const queryString = params.toString();
        const url = queryString ? `${API_BASE_URL}/recipes?${queryString}` : `${API_BASE_URL}/recipes`;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch recipes');
            const payload = await response.json();
            // Handle paginated response
            const recipes = Array.isArray(payload) ? payload :
                           (payload && Array.isArray(payload.recipes)) ? payload.recipes : [];
            // Cache recipes for offline use
            await OfflineDB.saveRecipes(recipes);
            return recipes;
        } catch (error) {
            console.error('Error fetching recipes:', error);
            // Try to get from offline cache
            if (!PWA.isOnline) {
                const cachedRecipes = await OfflineDB.getRecipes();
                if (cachedRecipes.length > 0) {
                    if (favoritesOnly) {
                        return cachedRecipes.filter(recipe => recipe.is_favorite);
                    }
                    console.log('[StorageService] Using cached recipes');
                    return cachedRecipes;
                }
            }
            return [];
        }
    },

    async toggleFavorite(recipeId, isFavorite) {
        try {
            const response = await fetch(`${API_BASE_URL}/recipes/${recipeId}/favorite`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isFavorite })
            });
            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                throw new Error(errorBody.error || 'Failed to update favorite');
            }
            return await response.json();
        } catch (error) {
            console.error('Error toggling favorite:', error);
            throw error;
        }
    },

    async addRecipe(recipe) {
        try {
            const response = await fetch(`${API_BASE_URL}/recipes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(recipe)
            });
            if (!response.ok) throw new Error('Failed to add recipe');
            return await response.json();
        } catch (error) {
            console.error('Error adding recipe:', error);
            // Queue for sync if offline
            if (!PWA.isOnline) {
                await OfflineDB.addPending('recipes', recipe, 'POST');
                Toast.show('Rezept wird synchronisiert, sobald du online bist', { type: 'default' });
                return { ...recipe, id: `offline-${Date.now()}`, offline: true };
            }
            throw error;
        }
    },

    async updateRecipe(recipe) {
        try {
            const response = await fetch(`${API_BASE_URL}/recipes/${recipe.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(recipe)
            });
            if (!response.ok) throw new Error('Failed to update recipe');
            return await response.json();
        } catch (error) {
            console.error('Error updating recipe:', error);
            throw error;
        }
    },

    async deleteRecipe(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/recipes/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete recipe');
            return await response.json();
        } catch (error) {
            console.error('Error deleting recipe:', error);
            throw error;
        }
    },

    async getRecipeById(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/recipes/${id}`);
            if (!response.ok) throw new Error('Failed to fetch recipe');
            return await response.json();
        } catch (error) {
            console.error('Error fetching recipe:', error);
            return null;
        }
    },

    async getWeekPlan() {
        try {
            const response = await fetch(`${API_BASE_URL}/weekplan`);
            if (!response.ok) throw new Error('Failed to fetch week plan');
            return await response.json();
        } catch (error) {
            console.error('Error fetching week plan:', error);
            return null;
        }
    },

    async getWeekPlanByDate(date) {
        try {
            const isoDate = new Date(date).toISOString().split('T')[0];
            const response = await fetch(`${API_BASE_URL}/weekplan/by-date/${isoDate}`);
            if (response.status === 404) return null;
            if (!response.ok) throw new Error('Failed to fetch week plan by date');
            return await response.json();
        } catch (error) {
            console.error('Error fetching week plan by date:', error);
            return null;
        }
    },

    async saveWeekPlan(weekPlan) {
        try {
            const response = await fetch(`${API_BASE_URL}/weekplan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(weekPlan)
            });
            if (!response.ok) throw new Error('Failed to save week plan');
            return await response.json();
        } catch (error) {
            console.error('Error saving week plan:', error);
            throw error;
        }
    },

    async clearWeekPlan() {
        try {
            const response = await fetch(`${API_BASE_URL}/weekplan`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to clear week plan');
            return await response.json();
        } catch (error) {
            console.error('Error clearing week plan:', error);
            throw error;
        }
    },

    // Template methods
    async getTemplates() {
        try {
            const response = await fetch(`${API_BASE_URL}/weekplan/templates`);
            if (!response.ok) throw new Error('Failed to fetch templates');
            return await response.json();
        } catch (error) {
            console.error('Error fetching templates:', error);
            return [];
        }
    },

    async getTemplateById(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/weekplan/templates/${id}`);
            if (!response.ok) throw new Error('Failed to fetch template');
            return await response.json();
        } catch (error) {
            console.error('Error fetching template:', error);
            return null;
        }
    },

    async saveTemplate(template) {
        try {
            const response = await fetch(`${API_BASE_URL}/weekplan/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(template)
            });
            if (!response.ok) throw new Error('Failed to save template');
            return await response.json();
        } catch (error) {
            console.error('Error saving template:', error);
            throw error;
        }
    },

    async updateTemplate(id, template) {
        try {
            const response = await fetch(`${API_BASE_URL}/weekplan/templates/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(template)
            });
            if (!response.ok) throw new Error('Failed to update template');
            return await response.json();
        } catch (error) {
            console.error('Error updating template:', error);
            throw error;
        }
    },

    async deleteTemplate(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/weekplan/templates/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete template');
            return await response.json();
        } catch (error) {
            console.error('Error deleting template:', error);
            throw error;
        }
    },

    // Manual shopping items methods
    async getManualShoppingItems() {
        try {
            const response = await fetch(`${API_BASE_URL}/shopping/manual`);
            if (!response.ok) throw new Error('Failed to fetch manual shopping items');
            return await response.json();
        } catch (error) {
            console.error('Error fetching manual shopping items:', error);
            return [];
        }
    },

    async addManualShoppingItem(item) {
        try {
            const response = await fetch(`${API_BASE_URL}/shopping/manual`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            if (!response.ok) throw new Error('Failed to add manual shopping item');
            return await response.json();
        } catch (error) {
            console.error('Error adding manual shopping item:', error);
            throw error;
        }
    },

    async deleteManualShoppingItem(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/shopping/manual/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete manual shopping item');
            return await response.json();
        } catch (error) {
            console.error('Error deleting manual shopping item:', error);
            throw error;
        }
    },

    async clearManualShoppingItems() {
        try {
            const response = await fetch(`${API_BASE_URL}/shopping/manual`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to clear manual shopping items');
            return await response.json();
        } catch (error) {
            console.error('Error clearing manual shopping items:', error);
            throw error;
        }
    },

    // Cooking History methods
    async getCookingHistory(page = 1, limit = 20) {
        try {
            const response = await fetch(`${API_BASE_URL}/cooking-history?page=${page}&limit=${limit}`);
            if (!response.ok) throw new Error('Failed to fetch cooking history');
            return await response.json();
        } catch (error) {
            console.error('Error fetching cooking history:', error);
            return { history: [], total: 0, page: 1, totalPages: 0 };
        }
    },

    async getCookingStats() {
        try {
            const response = await fetch(`${API_BASE_URL}/cooking-history/stats`);
            if (!response.ok) throw new Error('Failed to fetch cooking stats');
            return await response.json();
        } catch (error) {
            console.error('Error fetching cooking stats:', error);
            return [];
        }
    },

    async getRecipeCookingHistory(recipeId) {
        try {
            const response = await fetch(`${API_BASE_URL}/cooking-history/recipe/${recipeId}`);
            if (!response.ok) throw new Error('Failed to fetch recipe cooking history');
            return await response.json();
        } catch (error) {
            console.error('Error fetching recipe cooking history:', error);
            return [];
        }
    },

    async markAsCooked(recipeId, servings = null, notes = null) {
        try {
            const response = await fetch(`${API_BASE_URL}/cooking-history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipeId, servings, notes })
            });
            if (!response.ok) throw new Error('Failed to mark recipe as cooked');
            return await response.json();
        } catch (error) {
            console.error('Error marking recipe as cooked:', error);
            throw error;
        }
    },

    async deleteCookingHistoryEntry(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/cooking-history/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Failed to delete cooking history entry');
            return await response.json();
        } catch (error) {
            console.error('Error deleting cooking history entry:', error);
            throw error;
        }
    },

    async getNotCookedRecently(days = 30) {
        try {
            const response = await fetch(`${API_BASE_URL}/cooking-history/not-cooked-recently?days=${days}`);
            if (!response.ok) throw new Error('Failed to fetch not recently cooked recipes');
            return await response.json();
        } catch (error) {
            console.error('Error fetching not recently cooked recipes:', error);
            return [];
        }
    },

    // Seasonal methods
    async getSeasonInfo() {
        try {
            const response = await fetch(`${API_BASE_URL}/seasons`);
            if (!response.ok) throw new Error('Failed to fetch season info');
            return await response.json();
        } catch (error) {
            console.error('Error fetching season info:', error);
            return null;
        }
    },

    async getSeasonalIngredients(season = 'current') {
        try {
            const response = await fetch(`${API_BASE_URL}/seasons/${season}/ingredients`);
            if (!response.ok) throw new Error('Failed to fetch seasonal ingredients');
            return await response.json();
        } catch (error) {
            console.error('Error fetching seasonal ingredients:', error);
            return { ingredients: [] };
        }
    },

    async getSeasonalRecipes(options = {}) {
        try {
            const params = new URLSearchParams();
            if (options.season) params.set('season', options.season);
            if (options.minScore) params.set('minScore', String(options.minScore));

            const queryString = params.toString();
            const url = queryString ? `${API_BASE_URL}/recipes/seasonal?${queryString}` : `${API_BASE_URL}/recipes/seasonal`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch seasonal recipes');
            return await response.json();
        } catch (error) {
            console.error('Error fetching seasonal recipes:', error);
            return { recipes: [], season: '', seasonKey: '' };
        }
    },

    async getSeasonalRecommendations(limit = 6) {
        try {
            const response = await fetch(`${API_BASE_URL}/recipes/seasonal/recommendations?limit=${limit}`);
            if (!response.ok) throw new Error('Failed to fetch seasonal recommendations');
            return await response.json();
        } catch (error) {
            console.error('Error fetching seasonal recommendations:', error);
            return { recommendations: [], season: '', seasonKey: '', topSeasonalIngredients: [] };
        }
    },

    async checkIngredientsInSeason(ingredients, season = null) {
        try {
            const response = await fetch(`${API_BASE_URL}/seasons/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ingredients, season })
            });
            if (!response.ok) throw new Error('Failed to check ingredients');
            return await response.json();
        } catch (error) {
            console.error('Error checking ingredients:', error);
            return { ingredients: [] };
        }
    },

    // AI Recipe Analysis & Variants
    async analyzeRecipe(recipe) {
        try {
            const response = await fetch(`${API_BASE_URL}/ai/analyze-recipe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipe })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to analyze recipe');
            }
            return await response.json();
        } catch (error) {
            console.error('Error analyzing recipe:', error);
            throw error;
        }
    },

    async generateRecipeVariant(recipe, variantType) {
        try {
            const response = await fetch(`${API_BASE_URL}/ai/generate-variant`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipe, variantType })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate variant');
            }
            return await response.json();
        } catch (error) {
            console.error('Error generating recipe variant:', error);
            throw error;
        }
    },

    async getVariantTypes() {
        try {
            const response = await fetch(`${API_BASE_URL}/ai/variant-types`);
            if (!response.ok) throw new Error('Failed to get variant types');
            return await response.json();
        } catch (error) {
            console.error('Error getting variant types:', error);
            return { variantTypes: [] };
        }
    },

    async aiSearch(query, recipes) {
        try {
            const response = await fetch(`${API_BASE_URL}/ai/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, recipes })
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'AI search failed');
            }
            return await response.json();
        } catch (error) {
            console.error('Error in AI search:', error);
            throw error;
        }
    },

    async generateMealPrepSuggestions(payload) {
        try {
            const response = await fetch(`${API_BASE_URL}/ai/meal-prep-suggestions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Meal-Prep Vorschläge fehlgeschlagen');
            }
            return await response.json();
        } catch (error) {
            console.error('Error generating meal-prep suggestions:', error);
            throw error;
        }
    }
};

// App State
const AppState = {
    currentView: 'planner',
    recipes: [],
    weekPlan: null,
    currentWeekStart: null, // Track the current week being viewed
    weekPlansCache: {}, // Cache for multiple week plans
    _saveTimeout: null,

    ensureMealPrepPlanStructure(weekPlan) {
        if (!weekPlan || typeof weekPlan !== 'object') return;
        if (!weekPlan.mealPrepPlan || typeof weekPlan.mealPrepPlan !== 'object') {
            weekPlan.mealPrepPlan = {
                prepDate: null,
                items: {},
                aiSuggestions: null
            };
        } else {
            if (!('prepDate' in weekPlan.mealPrepPlan)) {
                weekPlan.mealPrepPlan.prepDate = null;
            }
            if (!weekPlan.mealPrepPlan.items || typeof weekPlan.mealPrepPlan.items !== 'object') {
                weekPlan.mealPrepPlan.items = {};
            }
            if (!('aiSuggestions' in weekPlan.mealPrepPlan)) {
                weekPlan.mealPrepPlan.aiSuggestions = null;
            }
        }
    },

    async init() {
        this.recipes = await StorageService.getRecipes({ all: true });
        // Set current week to Monday of current week
        this.currentWeekStart = DateUtils.getMonday(new Date());
        await this.loadWeekPlan(this.currentWeekStart);
        this.ensureMealPrepPlanStructure(this.weekPlan);
    },

    async loadWeekPlan(weekStart) {
        const weekId = DateUtils.getWeekId(weekStart);

        // Check cache first
        if (this.weekPlansCache[weekId]) {
            this.weekPlan = this.weekPlansCache[weekId];
            this.ensureMealPrepPlanStructure(this.weekPlan);
            return;
        }

        // Try to load from server
        const savedPlan = await StorageService.getWeekPlanByDate(weekStart);
        if (savedPlan) {
            this.weekPlan = savedPlan;
            this.ensureMealPrepPlanStructure(this.weekPlan);
            this.weekPlansCache[weekId] = savedPlan;
        } else {
            // Initialize new week plan for this week
            await this.initializeWeekPlan(weekStart);
            this.weekPlansCache[weekId] = this.weekPlan;
        }
    },

    async initializeWeekPlan(weekStart = null) {
        const monday = weekStart ? DateUtils.getMonday(weekStart) : DateUtils.getMonday(new Date());
        const weekId = DateUtils.getWeekId(monday);

        this.weekPlan = {
            id: weekId,
            startDate: monday.toISOString(),
            mealPrepPlan: {
                prepDate: null,
                items: {},
                aiSuggestions: null
            },
            days: Array.from({ length: 7 }, (_, index) => {
                const date = new Date(monday);
                date.setDate(monday.getDate() + index);
                return {
                    date: date.toISOString(),
                    dayName: DateUtils.formatDateWithDay(date).split(',')[0], // Just the day name for internal use
                    meals: {}
                };
            })
        };

        await StorageService.saveWeekPlan(this.weekPlan);
    },

    async persistWeekPlan() {
        if (!this.weekPlan) return;
        this.ensureMealPrepPlanStructure(this.weekPlan);
        await StorageService.saveWeekPlan(this.weekPlan);
        const weekId = DateUtils.getWeekId(this.currentWeekStart);
        this.weekPlansCache[weekId] = this.weekPlan;
    },

    schedulePersistWeekPlan(delay = 600) {
        clearTimeout(this._saveTimeout);
        this._saveTimeout = setTimeout(() => {
            this.persistWeekPlan().catch((error) => {
                console.error('[AppState] Failed to persist week plan', error);
            });
        }, delay);
    },

    async navigateWeek(direction) {
        const newWeekStart = new Date(this.currentWeekStart);
        newWeekStart.setDate(newWeekStart.getDate() + (direction * 7));
        this.currentWeekStart = newWeekStart;
        await this.loadWeekPlan(newWeekStart);
        App.render();
    },

    async goToCurrentWeek() {
        this.currentWeekStart = DateUtils.getMonday(new Date());
        await this.loadWeekPlan(this.currentWeekStart);
        App.render();
    },

    isCurrentWeek() {
        const today = DateUtils.getMonday(new Date());
        return this.currentWeekStart.getTime() === today.getTime();
    },

    setView(view) {
        this.currentView = view;
        App.render();
    },

    async reloadData() {
        this.recipes = await StorageService.getRecipes({ all: true });
        // Reload current week
        const weekId = DateUtils.getWeekId(this.currentWeekStart);
        delete this.weekPlansCache[weekId]; // Clear cache for this week
        await this.loadWeekPlan(this.currentWeekStart);
        this.ensureMealPrepPlanStructure(this.weekPlan);
    }
};

// Mobile detection and touch utilities
const MobileUtils = {
    isMobile() {
        return window.innerWidth < 640;
    },

    isTablet() {
        return window.innerWidth >= 640 && window.innerWidth < 1024;
    },

    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },

    // Swipe gesture detection
    setupSwipeGestures(element, callbacks) {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;
        const minSwipeDistance = 50;
        const maxVerticalDistance = 100;

        element.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        element.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            const horizontalDiff = touchEndX - touchStartX;
            const verticalDiff = Math.abs(touchEndY - touchStartY);

            // Only trigger if horizontal swipe is dominant
            if (Math.abs(horizontalDiff) > minSwipeDistance && verticalDiff < maxVerticalDistance) {
                if (horizontalDiff > 0 && callbacks.onSwipeRight) {
                    callbacks.onSwipeRight();
                } else if (horizontalDiff < 0 && callbacks.onSwipeLeft) {
                    callbacks.onSwipeLeft();
                }
            }
        }
    },

    // Pull to refresh
    setupPullToRefresh(element, onRefresh) {
        let startY = 0;
        let isPulling = false;
        const threshold = 80;

        element.addEventListener('touchstart', (e) => {
            if (element.scrollTop === 0) {
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        }, { passive: true });

        element.addEventListener('touchmove', (e) => {
            if (!isPulling) return;
            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;

            if (diff > 0 && diff < threshold * 2) {
                const pullIndicator = document.querySelector('.pull-to-refresh');
                if (pullIndicator) {
                    pullIndicator.classList.toggle('visible', diff > threshold / 2);
                }
            }
        }, { passive: true });

        element.addEventListener('touchend', async (e) => {
            if (!isPulling) return;
            isPulling = false;

            const pullIndicator = document.querySelector('.pull-to-refresh');
            if (pullIndicator && pullIndicator.classList.contains('visible')) {
                pullIndicator.classList.add('refreshing');
                await onRefresh();
                pullIndicator.classList.remove('visible', 'refreshing');
            }
        }, { passive: true });
    }
};

// Main App
const App = {
    mobileMenuOpen: false,

    async init() {
        DarkMode.init();
        await AppState.init();
        this.render();
        this.setupKeyboardShortcuts();
        this.setupMobileFeatures();
        // Initialize onboarding tour for new users
        OnboardingManager.init();
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't handle shortcuts when typing in inputs
            if (e.target.matches('input, textarea, select')) return;

            // Ctrl+Z or Cmd+Z for undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                ActionHistory.undo();
                return;
            }

            // Number keys 1-7 for view navigation (without modifiers)
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                const views = ['planner', 'meal-prep', 'recipes', 'ai-recipes', 'parser', 'shopping', 'history'];
                const keyNum = parseInt(e.key);
                if (keyNum >= 1 && keyNum <= views.length) {
                    e.preventDefault();
                    AppState.setView(views[keyNum - 1]);
                    return;
                }
            }

            // Escape key to close modals
            if (e.key === 'Escape') {
                // Close recipe detail
                if (RecipeDatabaseView.viewingRecipe) {
                    RecipeDatabaseView.closeRecipeDetail();
                    return;
                }
                // Close recipe form
                const recipeFormModal = document.getElementById('recipe-form-modal');
                if (recipeFormModal?.classList.contains('active')) {
                    RecipeDatabaseView.hideRecipeForm();
                    return;
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

    render() {
        const appElement = document.getElementById('app');
        appElement.innerHTML = `
            ${this.renderPullToRefresh()}
            ${this.renderHeader()}
            ${this.renderMobileNavigation()}
            ${this.renderNavigation()}
            <main id="main-content" class="container mx-auto px-4 py-4 sm:py-6 pb-safe" role="main" aria-label="Hauptinhalt">
                ${this.renderCurrentView()}
            </main>
        `;
        this.attachEventListeners();
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
            { id: 'history', label: 'Kochverlauf', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' }
        ];

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
            { id: 'history', label: 'Kochverlauf', shortLabel: 'Verlauf' }
        ];

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

    renderCurrentView() {
        switch (AppState.currentView) {
            case 'planner':
                return WeekPlannerView.render();
            case 'meal-prep':
                return MealPrepView.render();
            case 'recipes':
                return RecipeDatabaseView.render();
            case 'ai-recipes':
                return AIRecipeGeneratorView.render();
            case 'parser':
                return RecipeParserView.render();
            case 'shopping':
                return ShoppingListView.render();
            case 'history':
                return CookingHistoryView.render();
            default:
                return '<p>Ansicht nicht gefunden</p>';
        }
    },

    attachEventListeners() {
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

        // View-specific event listeners
        if (AppState.currentView === 'planner') {
            WeekPlannerView.attachEventListeners();
        } else if (AppState.currentView === 'meal-prep') {
            MealPrepView.attachEventListeners();
        } else if (AppState.currentView === 'recipes') {
            RecipeDatabaseView.attachEventListeners();
        } else if (AppState.currentView === 'ai-recipes') {
            AIRecipeGeneratorView.attachEventListeners();
        } else if (AppState.currentView === 'parser') {
            RecipeParserView.attachEventListeners();
        } else if (AppState.currentView === 'shopping') {
            ShoppingListView.attachEventListeners();
        } else if (AppState.currentView === 'history') {
            CookingHistoryView.attachEventListeners();
        }
    }
};

// Cooking History View
const CookingHistoryView = {
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
const WeekPlannerView = {
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
            <section class="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg shadow dark:shadow-gray-900 p-3 sm:p-4 transition-colors duration-200">
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                        <span class="text-xl">${seasonIcon}</span>
                        <h3 class="text-base font-semibold text-gray-800 dark:text-white">Saisonale Empfehlungen (${season})</h3>
                    </div>
                    <span class="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded-full">
                        ${topSeasonalIngredients.slice(0, 3).join(', ')}...
                    </span>
                </div>
                <div class="flex gap-3 overflow-x-auto pb-1">
                    ${recommendations.map(recipe => `
                        <div class="seasonal-recipe-card flex-shrink-0 min-w-[180px] max-w-[200px] px-4 py-3 rounded-lg border border-green-200 dark:border-green-800 bg-white dark:bg-gray-800 text-left transition-colors hover:bg-green-50 dark:hover:bg-green-900/30 cursor-pointer" data-recipe-id="${recipe.id}">
                            <div class="flex items-start justify-between gap-2 mb-1">
                                <span class="font-medium text-gray-800 dark:text-white text-sm line-clamp-2">${recipe.name}</span>
                                ${recipe.is_favorite ? `
                                    <svg class="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                                    </svg>
                                ` : ''}
                            </div>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">${recipe.category || 'Rezept'}</p>
                            <div class="flex items-center gap-2">
                                <span class="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                                    ${recipe.seasonalScore}% saisonal
                                </span>
                            </div>
                            ${recipe.seasonalIngredients && recipe.seasonalIngredients.length > 0 ? `
                                <p class="text-xs text-green-600 dark:text-green-400 mt-2 line-clamp-1" title="${recipe.seasonalIngredients.join(', ')}">
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
            return '<div class="text-gray-800 dark:text-gray-200">Lade Wochenplan...</div>';
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
                    <h2 class="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Wochenplan</h2>
                    <div class="flex gap-2 flex-wrap">
                        <button id="ai-generate-btn" class="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-purple-500 dark:bg-purple-600 text-white rounded hover:bg-purple-600 dark:hover:bg-purple-700 transition-colors text-sm sm:text-base flex items-center justify-center gap-2" ${this.aiGenerating ? 'disabled' : ''}>
                            <svg class="w-4 h-4 ${this.aiGenerating ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                ${this.aiGenerating
                                    ? '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>'
                                    : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>'
                                }
                            </svg>
                            <span class="hidden sm:inline">${this.aiGenerating ? 'Generiere...' : 'KI-Vorschläge'}</span>
                            <span class="sm:hidden">${this.aiGenerating ? '...' : 'KI'}</span>
                        </button>
                        <button id="save-template-btn" class="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors text-sm sm:text-base">
                            <span class="hidden sm:inline">Als Vorlage speichern</span>
                            <span class="sm:hidden">Speichern</span>
                        </button>
                        <button id="load-template-btn" class="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded hover:bg-green-600 dark:hover:bg-green-700 transition-colors text-sm sm:text-base">
                            <span class="hidden sm:inline">Aus Vorlage laden</span>
                            <span class="sm:hidden">Laden</span>
                        </button>
                        <button id="reset-week-btn" class="px-3 sm:px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded hover:bg-red-600 dark:hover:bg-red-700 transition-colors text-sm sm:text-base">
                            <span class="hidden sm:inline">Zurücksetzen</span>
                            <span class="sm:hidden">Reset</span>
                        </button>
                    </div>
                </div>

                ${this.renderSeasonalRecommendations()}

                <!-- Week Navigation -->
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-3 sm:p-4 transition-colors duration-200">
                    <div class="flex items-center justify-between">
                        <button id="prev-week-btn" class="p-3 sm:p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors active:scale-95" title="Vorherige Woche">
                            <svg class="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                            </svg>
                        </button>
                        <div class="text-center flex-1 mx-2">
                            <h3 class="text-base sm:text-xl font-semibold text-gray-800 dark:text-white">${weekRange}</h3>
                            ${!isCurrentWeek ? `
                                <button id="go-to-current-week-btn" class="mt-1 text-sm text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors">
                                    Zur aktuellen Woche
                                </button>
                            ` : '<span class="mt-1 text-sm text-green-600 dark:text-green-400 block">Aktuelle Woche</span>'}
                        </div>
                        <button id="next-week-btn" class="p-3 sm:p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors active:scale-95" title="Nächste Woche">
                            <svg class="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Mobile Day Selector -->
                <div class="sm:hidden">
                    <div class="flex items-center justify-between mb-3">
                        <button id="prev-day-btn" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors active:scale-95 ${this.mobileViewDay <= 0 ? 'opacity-50' : ''}" ${this.mobileViewDay <= 0 ? 'disabled' : ''}>
                            <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                                ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }" data-day-index="${index}">
                                        ${dayName}
                                    </button>
                                `;
                            }).join('')}
                        </div>
                        <button id="next-day-btn" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors active:scale-95 ${this.mobileViewDay >= 6 ? 'opacity-50' : ''}" ${this.mobileViewDay >= 6 ? 'disabled' : ''}>
                            <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                            </svg>
                        </button>
                    </div>
                    <!-- Swipe hint -->
                    <p class="text-xs text-center text-gray-400 dark:text-gray-500 mb-2">← Wischen für Tageswechsel →</p>
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
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-3 sm:p-4 transition-colors duration-200 ${isToday ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} ${isPast && !isMobileView ? 'opacity-75' : ''}">
                <div class="flex items-center justify-between gap-2 mb-3">
                    <div class="flex items-center gap-2">
                        <h3 class="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">${formattedDate}</h3>
                        ${isToday ? '<span class="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">Heute</span>' : ''}
                    </div>
                    ${isPast ? '<span class="text-xs text-gray-400 dark:text-gray-500">Vergangen</span>' : ''}
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    ${mealTypes.map(mealType => {
                        const meal = day.meals[mealType];
                        return `
                            <div class="border dark:border-gray-700 rounded-lg p-3 sm:p-3">
                                <div class="flex justify-between items-center mb-2">
                                    <h4 class="font-medium text-gray-700 dark:text-gray-300 text-sm sm:text-base">${mealType}</h4>
                                    ${meal ? `
                                        <button class="remove-meal-btn p-2 -mr-1 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
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
                                    <div class="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
                                        <p class="text-sm text-gray-800 dark:text-gray-200 font-medium ${meal.recipeId ? 'cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline open-recipe-btn' : ''}"
                                           ${meal.recipeId ? `data-recipe-id="${meal.recipeId}"` : ''}>${meal.recipeName}</p>
                                        <button class="mark-cooked-btn mt-3 w-full py-2.5 text-sm bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-700 transition-colors flex items-center justify-center gap-2 active:scale-98"
                                                data-recipe-id="${meal.recipeId}"
                                                data-recipe-name="${meal.recipeName}">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                            </svg>
                                            Als gekocht markieren
                                        </button>
                                    </div>
                                ` : `
                                    <button class="add-meal-btn w-full py-4 sm:py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-2 active:scale-98"
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
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-semibold text-gray-800 dark:text-white">Vorlage speichern</h3>
                        <button id="close-save-template" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl">
                            ✕
                        </button>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Name der Vorlage *
                            </label>
                            <input type="text" id="template-name-input"
                                   class="w-full px-3 py-2 border dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                   placeholder="z.B. Standardwoche, Sommerwoche..."
                                   required>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Beschreibung (optional)
                            </label>
                            <textarea id="template-description-input"
                                      class="w-full px-3 py-2 border dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                      rows="3"
                                      placeholder="Beschreibe diese Vorlage..."></textarea>
                        </div>
                        <div class="flex gap-2 justify-end">
                            <button id="cancel-save-template" class="px-4 py-2 border dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                Abbrechen
                            </button>
                            <button id="confirm-save-template" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
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
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                    <div class="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                        <h3 class="text-xl font-semibold text-gray-800 dark:text-white">Vorlage laden</h3>
                        <button id="close-load-template" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl">
                            ✕
                        </button>
                    </div>
                    <div id="templates-list" class="p-4 overflow-y-auto max-h-[60vh]">
                        <p class="text-gray-500 dark:text-gray-400 text-center py-8">Lade Vorlagen...</p>
                    </div>
                </div>
            </div>
        `;
    },

    renderRecipeSelector() {
        return `
            <div id="recipe-selector-modal" class="modal">
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                    <div class="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                        <h3 class="text-xl font-semibold text-gray-800 dark:text-white">Rezept auswählen</h3>
                        <button id="close-recipe-selector" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl">
                            ✕
                        </button>
                    </div>
                    <div class="p-4 overflow-y-auto max-h-[60vh]">
                        ${AppState.recipes.length === 0 ? `
                            <p class="text-gray-500 dark:text-gray-400 text-center py-8">
                                Noch keine Rezepte vorhanden. Erstelle zuerst Rezepte in der Rezeptdatenbank.
                            </p>
                        ` : `
                            <div class="grid gap-2">
                                ${AppState.recipes.map(recipe => `
                                    <button class="select-recipe-btn text-left p-3 border dark:border-gray-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                                            data-recipe-id="${recipe.id}">
                                        <p class="font-medium text-gray-800 dark:text-white">${recipe.name}</p>
                                        ${recipe.category ? `<p class="text-sm text-gray-600 dark:text-gray-400">${recipe.category}</p>` : ''}
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
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                            <svg class="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                            KI-Wochenplan generieren
                        </h3>
                        <button id="close-ai-generate" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl">
                            ✕
                        </button>
                    </div>

                    ${this.aiError ? `
                        <div class="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                            <p class="text-red-700 dark:text-red-300 text-sm">${this.aiError}</p>
                        </div>
                    ` : ''}

                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Für welche Mahlzeiten soll die KI Vorschläge erstellen?
                            </label>
                            <div class="space-y-2">
                                <label class="flex items-center gap-3 p-3 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    <input type="checkbox" id="ai-meal-breakfast" value="Frühstück" class="w-5 h-5 text-purple-500 rounded focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600">
                                    <span class="text-gray-800 dark:text-gray-200">Frühstück</span>
                                    <span class="text-gray-500 dark:text-gray-400 text-sm ml-auto">Schnelle, einfache Gerichte</span>
                                </label>
                                <label class="flex items-center gap-3 p-3 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    <input type="checkbox" id="ai-meal-lunch" value="Mittagessen" class="w-5 h-5 text-purple-500 rounded focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600">
                                    <span class="text-gray-800 dark:text-gray-200">Mittagessen</span>
                                    <span class="text-gray-500 dark:text-gray-400 text-sm ml-auto">Meal-Prep geeignet</span>
                                </label>
                                <label class="flex items-center gap-3 p-3 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    <input type="checkbox" id="ai-meal-dinner" value="Abendessen" checked class="w-5 h-5 text-purple-500 rounded focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600">
                                    <span class="text-gray-800 dark:text-gray-200">Abendessen</span>
                                    <span class="text-gray-500 dark:text-gray-400 text-sm ml-auto">Hauptmahlzeit des Tages</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Ernährungspräferenzen (optional)
                            </label>
                            <select id="ai-dietary-preference" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white">
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
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Kochzeit pro Mahlzeit
                                </label>
                                <select id="ai-cooking-time" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white">
                                    <option value="">Egal</option>
                                    <option value="schnell">Schnell (&lt; 30 Min)</option>
                                    <option value="mittel">Mittel (30-60 Min)</option>
                                    <option value="aufwendig">Aufwendig (&gt; 60 Min)</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Budget
                                </label>
                                <select id="ai-budget" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white">
                                    <option value="">Egal</option>
                                    <option value="günstig">Günstig</option>
                                    <option value="mittel">Mittel</option>
                                    <option value="gehoben">Gehoben</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Bevorzugte Küche (optional)
                            </label>
                            <select id="ai-cuisine" class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white">
                                <option value="">Gemischt / Keine Präferenz</option>
                                <option value="deutsch">Deutsche Küche</option>
                                <option value="italienisch">Italienisch</option>
                                <option value="asiatisch">Asiatisch</option>
                                <option value="mediterran">Mediterran</option>
                                <option value="mexikanisch">Mexikanisch</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Zutaten vermeiden (optional)
                            </label>
                            <input type="text" id="ai-avoid-ingredients"
                                   class="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                                   placeholder="z.B. Nüsse, Sellerie, Meeresfrüchte">
                        </div>

                        <div class="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                            <p class="text-sm text-purple-700 dark:text-purple-300">
                                <strong>Hinweis:</strong> Die KI erstellt Vorschläge für die gesamte angezeigte Woche.
                                Bestehende Mahlzeiten werden überschrieben.
                            </p>
                        </div>

                        <div class="flex gap-2 justify-end pt-2">
                            <button id="cancel-ai-generate" class="px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                Abbrechen
                            </button>
                            <button id="confirm-ai-generate" class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2">
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
                    await RecipeDatabaseView.viewRecipe(recipeId);
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
        if (mobileDayView && MobileUtils.isTouchDevice()) {
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
                        RecipeDatabaseView.viewRecipe(recipeId);
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

    showRecipeSelector() {
        const modal = document.getElementById('recipe-selector-modal');
        if (modal) modal.classList.add('active');
    },

    hideRecipeSelector() {
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
                <p class="text-gray-500 dark:text-gray-400 text-center py-8">
                    Noch keine Vorlagen vorhanden.<br>
                    Speichere deinen aktuellen Wochenplan als Vorlage!
                </p>
            `;
            return;
        }

        templatesList.innerHTML = `
            <div class="space-y-3">
                ${templates.map(template => `
                    <div class="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex-1">
                                <h4 class="font-semibold text-gray-800 dark:text-white">${template.name}</h4>
                                ${template.description ? `
                                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">${template.description}</p>
                                ` : ''}
                                <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">
                                    Erstellt: ${new Date(template.createdAt).toLocaleDateString('de-DE')}
                                </p>
                            </div>
                            <div class="flex gap-2">
                                <button class="load-template-btn px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-sm"
                                        data-template-id="${template.id}">
                                    Laden
                                </button>
                                <button class="delete-template-btn px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"
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
            const response = await fetch(`${API_BASE_URL}/ai/generate-weekplan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mealTypes,
                    days: 7,
                    preferences
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();

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
const RecipeDatabaseView = {
    editingRecipe: null,
    viewingRecipe: null, // For detail view (read-only)
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

            if (typeof marked !== 'undefined') {
                // Configure marked for safety
                marked.setOptions({
                    breaks: true,
                    gfm: true
                });
                return marked.parse(enhancedText);
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
            newBtn.addEventListener('click', () => this.showRecipeForm());
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

    showRecipeForm(recipe = null) {
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

        App.render();

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
        if (modal) modal.classList.add('active');
    },

    hideRecipeForm() {
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
            this.showRecipeForm(recipe);
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
        this.showRecipeForm(duplicatedRecipe);
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
            const response = await fetch('http://localhost:3000/ai/scale-portions', {
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
            const response = await fetch('http://localhost:3000/ai/categorize-ingredient', {
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

const MealPrepView = {
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
const AIRecipeGeneratorView = {
    ingredients: [''],
    preferences: {
        dietary: '',
        cookingTime: '',
        difficulty: ''
    },
    generatedRecipes: [],
    isLoading: false,

    render() {
        return `
            <div class="space-y-6">
                <div class="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
                    <h2 class="text-3xl font-bold mb-2">KI Rezept-Generator</h2>
                    <p class="text-blue-100">Gib deine verfügbaren Zutaten ein und lass die KI kreative Rezepte für dich generieren!</p>
                </div>

                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900 p-6 transition-colors duration-200">
                    <h3 class="text-xl font-semibold text-gray-800 dark:text-white mb-4">Verfügbare Zutaten</h3>

                    <div id="ai-ingredients-container" class="space-y-2 mb-4">
                        ${this.ingredients.map((ing, index) => `
                            <div class="flex gap-2">
                                <input type="text"
                                       placeholder="z.B. Tomaten, Nudeln, Hähnchen..."
                                       value="${ing}"
                                       data-index="${index}"
                                       class="ai-ingredient-input flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                                ${this.ingredients.length > 1 ? `
                                    <button type="button" class="remove-ai-ingredient-btn px-3 py-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300" data-index="${index}">
                                        ✕
                                    </button>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>

                    <button id="add-ai-ingredient-btn" class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                        + Zutat hinzufügen
                    </button>
                </div>

                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900 p-6 transition-colors duration-200">
                    <h3 class="text-xl font-semibold text-gray-800 dark:text-white mb-4">Präferenzen (optional)</h3>

                    <div class="grid md:grid-cols-3 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Ernährungsweise</label>
                            <select id="ai-dietary" class="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                                <option value="">Keine Einschränkung</option>
                                <option value="vegetarisch">Vegetarisch</option>
                                <option value="vegan">Vegan</option>
                                <option value="glutenfrei">Glutenfrei</option>
                                <option value="low-carb">Low Carb</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kochzeit</label>
                            <select id="ai-cooking-time" class="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                                <option value="">Egal</option>
                                <option value="15">Bis 15 Min</option>
                                <option value="30">Bis 30 Min</option>
                                <option value="60">Bis 60 Min</option>
                            </select>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Schwierigkeit</label>
                            <select id="ai-difficulty" class="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                                <option value="">Egal</option>
                                <option value="einfach">Einfach</option>
                                <option value="mittel">Mittel</option>
                                <option value="fortgeschritten">Fortgeschritten</option>
                            </select>
                        </div>
                    </div>

                    <button id="generate-recipes-btn"
                            class="mt-6 w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                            ${this.isLoading ? 'disabled' : ''}>
                        ${this.isLoading ? '⏳ Generiere Rezepte...' : '✨ Rezepte generieren'}
                    </button>
                </div>

                ${this.generatedRecipes.length > 0 ? `
                    <div class="space-y-4">
                        <h3 class="text-2xl font-bold text-gray-800 dark:text-white">Generierte Rezepte</h3>

                        ${this.generatedRecipes.map((recipe, index) => `
                            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900 p-6 transition-colors duration-200">
                                <div class="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 class="text-xl font-semibold text-gray-800 dark:text-white">${recipe.name}</h4>
                                        <div class="flex gap-2 mt-2">
                                            ${recipe.category ? `
                                                <span class="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs rounded">
                                                    ${recipe.category}
                                                </span>
                                            ` : ''}
                                            ${recipe.servings ? `
                                                <span class="inline-block px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-xs rounded">
                                                    ${recipe.servings} Portionen
                                                </span>
                                            ` : ''}
                                        </div>
                                    </div>
                                    <button class="save-ai-recipe-btn px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
                                            data-recipe-index="${index}">
                                        💾 Speichern
                                    </button>
                                </div>

                                <div class="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <h5 class="font-semibold text-gray-700 dark:text-gray-300 mb-2">Zutaten:</h5>
                                        <ul class="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                                            ${recipe.ingredients.map(ing => `
                                                <li>${ing.amount} ${ing.unit} ${ing.name}</li>
                                            `).join('')}
                                        </ul>
                                    </div>

                                    <div>
                                        <h5 class="font-semibold text-gray-700 dark:text-gray-300 mb-2">Zubereitung:</h5>
                                        <p class="text-gray-600 dark:text-gray-400 whitespace-pre-line">${recipe.instructions}</p>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    attachEventListeners() {
        // Ingredient inputs
        document.querySelectorAll('.ai-ingredient-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.ingredients[index] = e.target.value;
            });
        });

        // Add ingredient
        const addBtn = document.getElementById('add-ai-ingredient-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.ingredients.push('');
                App.render();
            });
        }

        // Remove ingredient
        document.querySelectorAll('.remove-ai-ingredient-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.ingredients.splice(index, 1);
                App.render();
            });
        });

        // Preferences
        const dietarySelect = document.getElementById('ai-dietary');
        const cookingTimeSelect = document.getElementById('ai-cooking-time');
        const difficultySelect = document.getElementById('ai-difficulty');

        if (dietarySelect) {
            dietarySelect.value = this.preferences.dietary;
            dietarySelect.addEventListener('change', (e) => {
                this.preferences.dietary = e.target.value;
            });
        }

        if (cookingTimeSelect) {
            cookingTimeSelect.value = this.preferences.cookingTime;
            cookingTimeSelect.addEventListener('change', (e) => {
                this.preferences.cookingTime = e.target.value;
            });
        }

        if (difficultySelect) {
            difficultySelect.value = this.preferences.difficulty;
            difficultySelect.addEventListener('change', (e) => {
                this.preferences.difficulty = e.target.value;
            });
        }

        // Generate button
        const generateBtn = document.getElementById('generate-recipes-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateRecipes());
        }

        // Save recipe buttons
        document.querySelectorAll('.save-ai-recipe-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const index = parseInt(e.target.dataset.recipeIndex);
                await this.saveRecipe(this.generatedRecipes[index]);
            });
        });
    },

    async generateRecipes() {
        const ingredients = this.ingredients.filter(ing => ing.trim() !== '');

        if (ingredients.length === 0) {
            Toast.error('Bitte gib mindestens eine Zutat ein');
            return;
        }

        this.isLoading = true;
        App.render();

        try {
            const response = await fetch(`${API_BASE_URL}/ai/generate-recipes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ingredients,
                    preferences: this.preferences
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Fehler beim Generieren der Rezepte');
            }

            const data = await response.json();
            const recipes = Array.isArray(data.recipes) ? data.recipes : [];
            this.generatedRecipes = recipes;
            if (recipes.length > 0) {
                Toast.success(`${recipes.length} Rezepte erfolgreich generiert! ✨`);
            } else {
                Toast.show('Es konnten keine Rezepte generiert werden.', { type: 'default' });
            }
        } catch (error) {
            console.error('Error generating recipes:', error);
            Toast.error(error.message || 'Fehler beim Generieren der Rezepte');
        } finally {
            this.isLoading = false;
            App.render();
        }
    },

    async saveRecipe(recipe) {
        try {
            await StorageService.addRecipe(recipe);
            await AppState.reloadData();
            Toast.success(`Rezept "${recipe.name}" gespeichert! ✓`);
        } catch (error) {
            console.error('Error saving recipe:', error);
            Toast.error('Fehler beim Speichern des Rezepts');
        }
    }
};

// Recipe Parser View
const RecipeParserView = {
    inputText: '',
    videoUrl: '',
    parsedRecipe: null,
    isLoading: false,
    isUrl: false,
    activeTab: 'text', // 'text' or 'video'
    disclaimerAccepted: false,
    showDisclaimer: false,

    render() {
        return `
            <div class="max-w-6xl mx-auto p-6">
                <h2 class="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">📝 Rezept Parser</h2>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Input Section -->
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <!-- Tab Navigation -->
                        <div class="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                            <button id="tab-text" class="px-4 py-2 font-medium transition-colors ${this.activeTab === 'text' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}">
                                📝 Text / URL
                            </button>
                            <button id="tab-video" class="px-4 py-2 font-medium transition-colors ${this.activeTab === 'video' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}">
                                🎬 Video
                            </button>
                        </div>

                        ${this.activeTab === 'text' ? this.renderTextInput() : this.renderVideoInput()}
                    </div>

                    <!-- Output Section -->
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h3 class="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Geparste Daten</h3>

                ${this.showDisclaimer ? this.renderDisclaimerModal() : ''}

                        ${this.parsedRecipe ? `
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                    <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">${this.parsedRecipe.name}</p>
                                </div>

                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategorie</label>
                                        <p class="text-gray-900 dark:text-gray-100">${this.parsedRecipe.category}</p>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Portionen</label>
                                        <p class="text-gray-900 dark:text-gray-100">${this.parsedRecipe.servings}</p>
                                    </div>
                                </div>

                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Zutaten</label>
                                    <ul class="space-y-2">
                                        ${this.parsedRecipe.ingredients.map(ing => `
                                            <li class="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                                                <span class="w-16 text-right font-mono text-sm">${ing.amount} ${ing.unit}</span>
                                                <span>${ing.name}</span>
                                                <span class="ml-auto text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">${ing.category}</span>
                                            </li>
                                        `).join('')}
                                    </ul>
                                </div>

                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Zubereitung</label>
                                    <p class="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">${this.parsedRecipe.instructions}</p>
                                </div>

                                <button
                                    id="save-parsed-recipe-btn"
                                    class="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                                >
                                    💾 Rezept speichern
                                </button>
                            </div>
                        ` : `
                            <div class="text-center py-12 text-gray-500 dark:text-gray-400">
                                <p class="text-lg mb-2">Noch kein Rezept geparst</p>
                                <p class="text-sm">Füge links einen Rezepttext ein und klicke auf "Rezept parsen"</p>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    },

    renderTextInput() {
        return `
            <h3 class="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Rezept eingeben</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                🔗 URL einer Rezeptseite ODER 📝 Rezepttext (von WhatsApp, E-Mail, etc.)
            </p>

            <textarea
                id="recipe-input"
                class="w-full h-80 p-4 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Option 1 - URL einfügen:\nhttps://www.chefkoch.de/rezepte/...\n\nOption 2 - Rezepttext einfügen:\n\nSpaghetti Carbonara\n\nZutaten:\n- 400g Spaghetti\n- 200g Speck..."
            >${this.inputText}</textarea>

            <button
                id="parse-recipe-btn"
                class="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                ${this.isLoading ? 'disabled' : ''}
            >
                ${this.isLoading ? '🔄 Wird geparst...' : '🤖 Rezept parsen'}
            </button>
        `;
    },

    renderVideoInput() {
        return `
            <h3 class="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">🎬 Video-Rezept importieren</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Importiere Rezepte aus TikTok, Instagram Reels, Pinterest oder YouTube Shorts
            </p>

            <div class="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <p class="text-sm text-purple-700 dark:text-purple-300">
                    <strong>Unterstützte Plattformen:</strong><br>
                    TikTok, Instagram Reels, Pinterest Pins, YouTube Shorts
                </p>
            </div>

            <input
                type="url"
                id="video-url-input"
                class="w-full p-4 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="https://www.tiktok.com/@user/video/..."
                value="${this.videoUrl}"
            />

            <div class="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <label class="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" id="disclaimer-checkbox" class="mt-1 w-4 h-4 accent-amber-500" ${this.disclaimerAccepted ? 'checked' : ''}>
                    <span class="text-sm text-amber-800 dark:text-amber-300">
                        Ich bestätige, dass ich berechtigt bin, dieses Video zu nutzen und respektiere die Urheberrechte des Erstellers.
                    </span>
                </label>
            </div>

            <button
                id="parse-video-btn"
                class="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                ${this.isLoading || !this.disclaimerAccepted ? 'disabled' : ''}
            >
                ${this.isLoading ? `
                    <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Video wird analysiert...
                ` : '🎬 Video-Rezept extrahieren'}
            </button>

            <p class="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
                Das Video wird heruntergeladen, analysiert und danach gelöscht.
            </p>
        `;
    },

    renderDisclaimerModal() {
        return `
            <div class="modal active">
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
                    <h3 class="text-xl font-semibold mb-4 text-gray-800 dark:text-white">⚠️ Rechtlicher Hinweis</h3>
                    <p class="text-gray-600 dark:text-gray-400 mb-4">
                        Diese Funktion ist ausschließlich für Videos gedacht, zu deren Nutzung du berechtigt bist.
                    </p>
                    <ul class="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-4 space-y-1">
                        <li>Originalvideos werden nicht gespeichert</li>
                        <li>Respektiere die Urheberrechte der Content-Creator</li>
                        <li>Nutze diese Funktion nur für persönliche Zwecke</li>
                    </ul>
                    <div class="flex gap-3">
                        <button id="disclaimer-cancel" class="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                            Abbrechen
                        </button>
                        <button id="disclaimer-accept" class="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                            Verstanden
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    attachEventListeners() {
        // Tab buttons
        const tabText = document.getElementById('tab-text');
        const tabVideo = document.getElementById('tab-video');

        if (tabText) {
            tabText.addEventListener('click', () => {
                this.activeTab = 'text';
                App.render();
            });
        }

        if (tabVideo) {
            tabVideo.addEventListener('click', () => {
                this.activeTab = 'video';
                App.render();
            });
        }

        // Text input textarea
        const input = document.getElementById('recipe-input');
        if (input) {
            input.addEventListener('input', (e) => {
                this.inputText = e.target.value;
            });
        }

        // Video URL input
        const videoInput = document.getElementById('video-url-input');
        if (videoInput) {
            videoInput.addEventListener('input', (e) => {
                this.videoUrl = e.target.value;
            });
        }

        // Disclaimer checkbox
        const disclaimerCheck = document.getElementById('disclaimer-checkbox');
        if (disclaimerCheck) {
            disclaimerCheck.addEventListener('change', (e) => {
                this.disclaimerAccepted = e.target.checked;
                App.render();
            });
        }

        // Parse text button
        const parseBtn = document.getElementById('parse-recipe-btn');
        if (parseBtn) {
            parseBtn.addEventListener('click', () => this.parseRecipe());
        }

        // Parse video button
        const parseVideoBtn = document.getElementById('parse-video-btn');
        if (parseVideoBtn) {
            parseVideoBtn.addEventListener('click', () => this.parseVideoRecipe());
        }

        // Save button
        const saveBtn = document.getElementById('save-parsed-recipe-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveParsedRecipe());
        }

        // Disclaimer modal buttons
        const disclaimerCancel = document.getElementById('disclaimer-cancel');
        if (disclaimerCancel) {
            disclaimerCancel.addEventListener('click', () => {
                this.showDisclaimer = false;
                App.render();
            });
        }

        const disclaimerAccept = document.getElementById('disclaimer-accept');
        if (disclaimerAccept) {
            disclaimerAccept.addEventListener('click', () => {
                this.disclaimerAccepted = true;
                this.showDisclaimer = false;
                App.render();
            });
        }
    },

    async parseRecipe() {
        if (!this.inputText.trim()) {
            Toast.error('Bitte gib eine URL oder einen Rezepttext ein');
            return;
        }

        this.isUrl = this.inputText.trim().startsWith('http://') || this.inputText.trim().startsWith('https://');

        this.isLoading = true;
        this.parsedRecipe = null;
        App.render();

        try {
            const response = await fetch(`${API_BASE_URL}/ai/parse-recipe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: this.inputText,
                    type: this.isUrl ? 'url' : 'text'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to parse recipe');
            }

            const data = await response.json();
            this.parsedRecipe = data.recipe;
            this.isLoading = false;
            App.render();
            Toast.success('Rezept erfolgreich geparst! ✓');
        } catch (error) {
            this.isLoading = false;
            App.render();
            Toast.error(`Fehler beim Parsen: ${error.message}`);
            console.error('Parse error:', error);
        }
    },

    async parseVideoRecipe() {
        if (!this.videoUrl.trim()) {
            Toast.error('Bitte gib eine Video-URL ein');
            return;
        }

        if (!this.disclaimerAccepted) {
            Toast.error('Bitte akzeptiere den Haftungsausschluss');
            return;
        }

        this.isLoading = true;
        this.parsedRecipe = null;
        App.render();

        try {
            const response = await fetch(`${API_BASE_URL}/ai/parse-video-recipe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: this.videoUrl,
                    acceptDisclaimer: true
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || error.hint || 'Video-Analyse fehlgeschlagen');
            }

            const data = await response.json();
            this.parsedRecipe = data.recipe;
            this.isLoading = false;
            App.render();
            Toast.success(`Rezept "${data.recipe.name}" aus ${data.platform} extrahiert! ✓`);
        } catch (error) {
            this.isLoading = false;
            App.render();
            Toast.error(`Fehler: ${error.message}`);
            console.error('Video parse error:', error);
        }
    },

    async saveParsedRecipe() {
        if (!this.parsedRecipe) {
            Toast.error('Kein Rezept zum Speichern vorhanden');
            return;
        }

        try {
            await StorageService.addRecipe(this.parsedRecipe);
            await AppState.reloadData();
            Toast.success(`Rezept "${this.parsedRecipe.name}" gespeichert ✓`);

            // Reset and switch to recipes view
            this.inputText = '';
            this.videoUrl = '';
            this.parsedRecipe = null;
            this.disclaimerAccepted = false;
            AppState.setView('recipes');
        } catch (error) {
            Toast.error('Fehler beim Speichern des Rezepts');
            console.error('Save error:', error);
        }
    }
};

// Shopping List View
const ShoppingListView = {
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

    showAddManualItemModal() {
        const modal = document.getElementById('add-manual-item-modal');
        if (modal) modal.classList.add('active');
    },

    hideAddManualItemModal() {
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
                headers: { 'Content-Type': 'application/json' },
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
                headers: { 'Content-Type': 'application/json' },
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
                headers: { 'Content-Type': 'application/json' },
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

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize PWA first
    await PWA.init();
    // Then initialize the app
    App.init();
});
