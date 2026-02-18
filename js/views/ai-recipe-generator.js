import { AppState } from '../core/app-state.js';
import { StorageService } from '../core/storage-service.js';
import { Toast } from '../core/toast.js';
import { App } from '../app.js';
import { API_BASE_URL } from '../config.js';

export const AIRecipeGeneratorView = {
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
