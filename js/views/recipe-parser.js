import { AppState } from '../core/app-state.js';
import { StorageService } from '../core/storage-service.js';
import { Toast } from '../core/toast.js';
import { escapeHtml } from '../core/utils.js';
import { Auth } from '../core/auth.js';
import { App } from '../app.js';
import { API_BASE_URL } from '../config.js';
import { api } from '../core/api.js';

export const RecipeParserView = {
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
                                    <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">${escapeHtml(this.parsedRecipe.name)}</p>
                                </div>

                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategorie</label>
                                        <p class="text-gray-900 dark:text-gray-100">${escapeHtml(this.parsedRecipe.category)}</p>
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
                                                <span class="w-16 text-right font-mono text-sm">${escapeHtml(ing.amount || '')} ${escapeHtml(ing.unit || '')}</span>
                                                <span>${escapeHtml(ing.name)}</span>
                                                <span class="ml-auto text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">${escapeHtml(ing.category || '')}</span>
                                            </li>
                                        `).join('')}
                                    </ul>
                                </div>

                                <div>
                                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Zubereitung</label>
                                    <p class="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">${escapeHtml(this.parsedRecipe.instructions)}</p>
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
            const data = await api.post(`${API_BASE_URL}/ai/parse-recipe`, {
                    input: this.inputText,
                    type: this.isUrl ? 'url' : 'text'
                });
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
            const data = await api.post(`${API_BASE_URL}/ai/parse-video-recipe`, {
                    url: this.videoUrl,
                    acceptDisclaimer: true
                });
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
