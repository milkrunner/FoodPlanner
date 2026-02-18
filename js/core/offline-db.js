// IndexedDB for Offline Storage
export const OfflineDB = {
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
