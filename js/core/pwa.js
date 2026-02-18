import { API_BASE_URL } from '../config.js';
import { OfflineDB } from './offline-db.js';
import { Toast } from './toast.js';

// PWA & Offline Support
export const PWA = {
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
