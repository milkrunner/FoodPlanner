// Storage Service
const StorageService = {
    KEYS: {
        RECIPES: 'foodPlanner_recipes',
        WEEK_PLAN: 'foodPlanner_weekPlan'
    },

    getRecipes() {
        const data = localStorage.getItem(this.KEYS.RECIPES);
        return data ? JSON.parse(data) : [];
    },

    saveRecipes(recipes) {
        localStorage.setItem(this.KEYS.RECIPES, JSON.stringify(recipes));
    },

    addRecipe(recipe) {
        const recipes = this.getRecipes();
        recipes.push(recipe);
        this.saveRecipes(recipes);
    },

    updateRecipe(recipe) {
        const recipes = this.getRecipes();
        const index = recipes.findIndex(r => r.id === recipe.id);
        if (index !== -1) {
            recipes[index] = recipe;
            this.saveRecipes(recipes);
        }
    },

    deleteRecipe(id) {
        const recipes = this.getRecipes();
        const filtered = recipes.filter(r => r.id !== id);
        this.saveRecipes(filtered);
    },

    getRecipeById(id) {
        const recipes = this.getRecipes();
        return recipes.find(r => r.id === id);
    },

    getWeekPlan() {
        const data = localStorage.getItem(this.KEYS.WEEK_PLAN);
        return data ? JSON.parse(data) : null;
    },

    saveWeekPlan(weekPlan) {
        localStorage.setItem(this.KEYS.WEEK_PLAN, JSON.stringify(weekPlan));
    },

    clearWeekPlan() {
        localStorage.removeItem(this.KEYS.WEEK_PLAN);
    }
};

// App State
const AppState = {
    currentView: 'planner',
    recipes: [],
    weekPlan: null,

    init() {
        this.recipes = StorageService.getRecipes();
        this.weekPlan = StorageService.getWeekPlan();
        if (!this.weekPlan) {
            this.initializeWeekPlan();
        }
    },

    initializeWeekPlan() {
        const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
        const startDate = new Date();

        this.weekPlan = {
            id: Date.now().toString(),
            startDate: startDate.toISOString(),
            days: days.map((dayName, index) => {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + index);
                return {
                    date: date.toISOString(),
                    dayName,
                    meals: {}
                };
            })
        };

        StorageService.saveWeekPlan(this.weekPlan);
    },

    setView(view) {
        this.currentView = view;
        App.render();
    },

    reloadData() {
        this.recipes = StorageService.getRecipes();
        this.weekPlan = StorageService.getWeekPlan();
    }
};

// Main App
const App = {
    init() {
        AppState.init();
        this.render();
    },

    render() {
        const appElement = document.getElementById('app');
        appElement.innerHTML = `
            ${this.renderHeader()}
            ${this.renderNavigation()}
            <main class="container mx-auto px-4 py-6">
                ${this.renderCurrentView()}
            </main>
        `;
        this.attachEventListeners();
    },

    renderHeader() {
        return `
            <header class="bg-white shadow-md">
                <div class="container mx-auto px-4 py-4">
                    <h1 class="text-3xl font-bold text-gray-800">Food Planner</h1>
                    <p class="text-gray-600">Dein persönlicher Essenswochenplaner</p>
                </div>
            </header>
        `;
    },

    renderNavigation() {
        const tabs = [
            { id: 'planner', label: 'Wochenplan' },
            { id: 'recipes', label: 'Rezepte' },
            { id: 'shopping', label: 'Einkaufsliste' }
        ];

        return `
            <nav class="bg-white border-b">
                <div class="container mx-auto px-4">
                    <div class="flex space-x-1">
                        ${tabs.map(tab => `
                            <button
                                class="nav-btn px-6 py-3 font-medium transition-colors ${
                                    AppState.currentView === tab.id
                                        ? 'text-blue-600 border-b-2 border-blue-600'
                                        : 'text-gray-600 hover:text-blue-600'
                                }"
                                data-view="${tab.id}"
                            >
                                ${tab.label}
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
            case 'recipes':
                return RecipeDatabaseView.render();
            case 'shopping':
                return ShoppingListView.render();
            default:
                return '<p>Ansicht nicht gefunden</p>';
        }
    },

    attachEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                AppState.setView(view);
            });
        });

        // View-specific event listeners
        if (AppState.currentView === 'planner') {
            WeekPlannerView.attachEventListeners();
        } else if (AppState.currentView === 'recipes') {
            RecipeDatabaseView.attachEventListeners();
        } else if (AppState.currentView === 'shopping') {
            ShoppingListView.attachEventListeners();
        }
    }
};

// Week Planner View
const WeekPlannerView = {
    selectedDay: null,
    selectedMealType: null,

    render() {
        if (!AppState.weekPlan) {
            return '<div>Lade Wochenplan...</div>';
        }

        const mealTypes = ['Frühstück', 'Mittagessen', 'Abendessen'];

        return `
            <div class="space-y-6">
                <div class="flex justify-between items-center">
                    <h2 class="text-2xl font-bold text-gray-800">Wochenplan</h2>
                    <button id="reset-week-btn" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
                        Plan zurücksetzen
                    </button>
                </div>

                <div class="grid gap-4">
                    ${AppState.weekPlan.days.map((day, dayIndex) => `
                        <div class="bg-white rounded-lg shadow p-4">
                            <h3 class="text-xl font-semibold text-gray-800 mb-3">${day.dayName}</h3>
                            <div class="grid md:grid-cols-3 gap-3">
                                ${mealTypes.map(mealType => {
                                    const meal = day.meals[mealType];
                                    return `
                                        <div class="border rounded p-3">
                                            <div class="flex justify-between items-center mb-2">
                                                <h4 class="font-medium text-gray-700">${mealType}</h4>
                                                ${meal ? `
                                                    <button class="remove-meal-btn text-red-500 hover:text-red-700 text-sm"
                                                            data-day="${dayIndex}"
                                                            data-meal="${mealType}">
                                                        ✕
                                                    </button>
                                                ` : ''}
                                            </div>
                                            ${meal ? `
                                                <div class="bg-blue-50 p-2 rounded">
                                                    <p class="text-sm text-gray-800">${meal.recipeName}</p>
                                                </div>
                                            ` : `
                                                <button class="add-meal-btn w-full py-2 border-2 border-dashed border-gray-300 rounded text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
                                                        data-day="${dayIndex}"
                                                        data-meal="${mealType}">
                                                    + Rezept hinzufügen
                                                </button>
                                            `}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>

                ${this.renderRecipeSelector()}
            </div>
        `;
    },

    renderRecipeSelector() {
        return `
            <div id="recipe-selector-modal" class="modal">
                <div class="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                    <div class="p-4 border-b flex justify-between items-center">
                        <h3 class="text-xl font-semibold">Rezept auswählen</h3>
                        <button id="close-recipe-selector" class="text-gray-500 hover:text-gray-700 text-2xl">
                            ✕
                        </button>
                    </div>
                    <div class="p-4 overflow-y-auto max-h-[60vh]">
                        ${AppState.recipes.length === 0 ? `
                            <p class="text-gray-500 text-center py-8">
                                Noch keine Rezepte vorhanden. Erstelle zuerst Rezepte in der Rezeptdatenbank.
                            </p>
                        ` : `
                            <div class="grid gap-2">
                                ${AppState.recipes.map(recipe => `
                                    <button class="select-recipe-btn text-left p-3 border rounded hover:bg-blue-50 hover:border-blue-400 transition-colors"
                                            data-recipe-id="${recipe.id}">
                                        <p class="font-medium">${recipe.name}</p>
                                        ${recipe.category ? `<p class="text-sm text-gray-600">${recipe.category}</p>` : ''}
                                    </button>
                                `).join('')}
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    },

    attachEventListeners() {
        // Reset week plan
        const resetBtn = document.getElementById('reset-week-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (confirm('Möchtest du den Wochenplan wirklich zurücksetzen?')) {
                    AppState.initializeWeekPlan();
                    App.render();
                }
            });
        }

        // Add meal buttons
        document.querySelectorAll('.add-meal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectedDay = parseInt(e.target.dataset.day);
                this.selectedMealType = e.target.dataset.meal;
                this.showRecipeSelector();
            });
        });

        // Remove meal buttons
        document.querySelectorAll('.remove-meal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dayIndex = parseInt(e.target.dataset.day);
                const mealType = e.target.dataset.meal;
                this.removeMeal(dayIndex, mealType);
            });
        });

        // Close recipe selector
        const closeBtn = document.getElementById('close-recipe-selector');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideRecipeSelector());
        }

        // Select recipe buttons
        document.querySelectorAll('.select-recipe-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const recipeId = e.currentTarget.dataset.recipeId;
                this.assignRecipe(recipeId);
            });
        });
    },

    showRecipeSelector() {
        const modal = document.getElementById('recipe-selector-modal');
        if (modal) modal.classList.add('active');
    },

    hideRecipeSelector() {
        const modal = document.getElementById('recipe-selector-modal');
        if (modal) modal.classList.remove('active');
    },

    assignRecipe(recipeId) {
        const recipe = StorageService.getRecipeById(recipeId);
        if (!recipe || this.selectedMealType === null) return;

        AppState.weekPlan.days[this.selectedDay].meals[this.selectedMealType] = {
            id: Date.now().toString(),
            recipeId: recipe.id,
            recipeName: recipe.name,
            mealType: this.selectedMealType
        };

        StorageService.saveWeekPlan(AppState.weekPlan);
        this.hideRecipeSelector();
        App.render();
    },

    removeMeal(dayIndex, mealType) {
        delete AppState.weekPlan.days[dayIndex].meals[mealType];
        StorageService.saveWeekPlan(AppState.weekPlan);
        App.render();
    }
};

// Recipe Database View
const RecipeDatabaseView = {
    editingRecipe: null,
    ingredients: [{ name: '', amount: '', unit: '' }],

    render() {
        return `
            <div class="space-y-6">
                <div class="flex justify-between items-center">
                    <h2 class="text-2xl font-bold text-gray-800">Rezeptdatenbank</h2>
                    <button id="new-recipe-btn" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                        + Neues Rezept
                    </button>
                </div>

                ${AppState.recipes.length === 0 ? `
                    <div class="bg-white rounded-lg shadow p-8 text-center">
                        <p class="text-gray-500">Noch keine Rezepte vorhanden.</p>
                        <p class="text-gray-400 text-sm mt-2">Erstelle dein erstes Rezept!</p>
                    </div>
                ` : `
                    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${AppState.recipes.map(recipe => `
                            <div class="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
                                <h3 class="text-lg font-semibold text-gray-800 mb-2">${recipe.name}</h3>
                                ${recipe.category ? `
                                    <span class="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded mb-2">
                                        ${recipe.category}
                                    </span>
                                ` : ''}
                                ${recipe.servings ? `<p class="text-sm text-gray-600 mb-2">Portionen: ${recipe.servings}</p>` : ''}
                                <p class="text-sm text-gray-600 mb-3">
                                    ${recipe.ingredients.length} Zutat${recipe.ingredients.length !== 1 ? 'en' : ''}
                                </p>
                                <div class="flex gap-2">
                                    <button class="edit-recipe-btn flex-1 px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
                                            data-recipe-id="${recipe.id}">
                                        Bearbeiten
                                    </button>
                                    <button class="delete-recipe-btn px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-sm"
                                            data-recipe-id="${recipe.id}">
                                        Löschen
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}

                ${this.renderRecipeForm()}
            </div>
        `;
    },

    renderRecipeForm() {
        return `
            <div id="recipe-form-modal" class="modal">
                <div class="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
                    <div class="p-4 border-b flex justify-between items-center">
                        <h3 class="text-xl font-semibold">
                            ${this.editingRecipe ? 'Rezept bearbeiten' : 'Neues Rezept'}
                        </h3>
                        <button id="close-recipe-form" class="text-gray-500 hover:text-gray-700 text-2xl">
                            ✕
                        </button>
                    </div>
                    <form id="recipe-form" class="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Rezeptname *</label>
                                <input type="text" id="recipe-name" required
                                       class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                            </div>

                            <div class="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Kategorie</label>
                                    <input type="text" id="recipe-category" placeholder="z.B. Hauptgericht, Dessert"
                                           class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Portionen</label>
                                    <input type="number" id="recipe-servings" min="1"
                                           class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                                </div>
                            </div>

                            <div>
                                <div class="flex justify-between items-center mb-2">
                                    <label class="block text-sm font-medium text-gray-700">Zutaten</label>
                                    <button type="button" id="add-ingredient-btn" class="text-sm text-blue-600 hover:text-blue-700">
                                        + Zutat hinzufügen
                                    </button>
                                </div>
                                <div id="ingredients-container"></div>
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Zubereitung</label>
                                <textarea id="recipe-instructions" rows="5" placeholder="Beschreibe die Zubereitungsschritte..."
                                          class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                            </div>
                        </div>

                        <div class="flex gap-3 mt-6">
                            <button type="submit" class="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                                ${this.editingRecipe ? 'Aktualisieren' : 'Erstellen'}
                            </button>
                            <button type="button" id="cancel-recipe-form" class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors">
                                Abbrechen
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },

    attachEventListeners() {
        // New recipe button
        const newBtn = document.getElementById('new-recipe-btn');
        if (newBtn) {
            newBtn.addEventListener('click', () => this.showRecipeForm());
        }

        // Edit recipe buttons
        document.querySelectorAll('.edit-recipe-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const recipeId = e.target.dataset.recipeId;
                this.editRecipe(recipeId);
            });
        });

        // Delete recipe buttons
        document.querySelectorAll('.delete-recipe-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const recipeId = e.target.dataset.recipeId;
                this.deleteRecipe(recipeId);
            });
        });

        // Form close buttons
        const closeBtn = document.getElementById('close-recipe-form');
        const cancelBtn = document.getElementById('cancel-recipe-form');
        if (closeBtn) closeBtn.addEventListener('click', () => this.hideRecipeForm());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hideRecipeForm());

        // Add ingredient button
        const addIngBtn = document.getElementById('add-ingredient-btn');
        if (addIngBtn) {
            addIngBtn.addEventListener('click', () => {
                this.ingredients.push({ name: '', amount: '', unit: '' });
                this.renderIngredients();
            });
        }

        // Recipe form submit
        const form = document.getElementById('recipe-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveRecipe();
            });
        }

        this.renderIngredients();
    },

    renderIngredients() {
        const container = document.getElementById('ingredients-container');
        if (!container) return;

        container.innerHTML = this.ingredients.map((ing, index) => `
            <div class="flex gap-2 mb-2">
                <input type="text" placeholder="Zutat" value="${ing.name}" data-index="${index}" data-field="name"
                       class="ingredient-input flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                <input type="text" placeholder="Menge" value="${ing.amount}" data-index="${index}" data-field="amount"
                       class="ingredient-input w-24 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                <input type="text" placeholder="Einheit" value="${ing.unit}" data-index="${index}" data-field="unit"
                       class="ingredient-input w-24 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                <button type="button" class="remove-ingredient-btn px-3 py-2 text-red-600 hover:text-red-700" data-index="${index}">
                    ✕
                </button>
            </div>
        `).join('');

        // Attach ingredient input listeners
        document.querySelectorAll('.ingredient-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;
                this.ingredients[index][field] = e.target.value;
            });
        });

        // Attach remove ingredient listeners
        document.querySelectorAll('.remove-ingredient-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.ingredients.splice(index, 1);
                if (this.ingredients.length === 0) {
                    this.ingredients = [{ name: '', amount: '', unit: '' }];
                }
                this.renderIngredients();
            });
        });
    },

    showRecipeForm(recipe = null) {
        this.editingRecipe = recipe;

        if (recipe) {
            this.ingredients = recipe.ingredients.length > 0 ? [...recipe.ingredients] : [{ name: '', amount: '', unit: '' }];
        } else {
            this.ingredients = [{ name: '', amount: '', unit: '' }];
        }

        App.render();

        // Populate form
        if (recipe) {
            document.getElementById('recipe-name').value = recipe.name || '';
            document.getElementById('recipe-category').value = recipe.category || '';
            document.getElementById('recipe-servings').value = recipe.servings || '';
            document.getElementById('recipe-instructions').value = recipe.instructions || '';
        }

        const modal = document.getElementById('recipe-form-modal');
        if (modal) modal.classList.add('active');
    },

    hideRecipeForm() {
        const modal = document.getElementById('recipe-form-modal');
        if (modal) modal.classList.remove('active');
        this.editingRecipe = null;
    },

    editRecipe(recipeId) {
        const recipe = StorageService.getRecipeById(recipeId);
        if (recipe) {
            this.showRecipeForm(recipe);
        }
    },

    deleteRecipe(recipeId) {
        if (confirm('Möchtest du dieses Rezept wirklich löschen?')) {
            StorageService.deleteRecipe(recipeId);
            AppState.reloadData();
            App.render();
        }
    },

    saveRecipe() {
        const name = document.getElementById('recipe-name').value.trim();
        const category = document.getElementById('recipe-category').value.trim();
        const servings = document.getElementById('recipe-servings').value;
        const instructions = document.getElementById('recipe-instructions').value.trim();

        if (!name) {
            alert('Bitte gib einen Rezeptnamen ein.');
            return;
        }

        const validIngredients = this.ingredients.filter(ing => ing.name.trim() !== '');

        const recipe = {
            id: this.editingRecipe?.id || Date.now().toString(),
            name,
            category: category || undefined,
            servings: servings ? parseInt(servings) : undefined,
            instructions: instructions || undefined,
            ingredients: validIngredients
        };

        if (this.editingRecipe) {
            StorageService.updateRecipe(recipe);
        } else {
            StorageService.addRecipe(recipe);
        }

        AppState.reloadData();
        this.hideRecipeForm();
        App.render();
    }
};

// Shopping List View
const ShoppingListView = {
    shoppingList: [],

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
                <div class="bg-white rounded-lg shadow p-8 text-center">
                    <p class="text-gray-500">Keine Zutaten im Wochenplan.</p>
                    <p class="text-gray-400 text-sm mt-2">
                        Füge Rezepte zu deinem Wochenplan hinzu, um eine Einkaufsliste zu erstellen.
                    </p>
                </div>
            `;
        }

        const checkedCount = this.shoppingList.filter(item => item.checked).length;
        const progress = (checkedCount / this.shoppingList.length) * 100;

        return `
            <div class="space-y-6">
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-800">Einkaufsliste</h2>
                        <p class="text-sm text-gray-600 mt-1">
                            ${checkedCount} von ${this.shoppingList.length} Artikel${this.shoppingList.length !== 1 ? 'n' : ''} abgehakt
                        </p>
                    </div>
                    <div class="flex gap-2">
                        <button id="copy-list-btn" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors">
                            Kopieren
                        </button>
                        <button id="export-list-btn" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                            Exportieren
                        </button>
                        ${checkedCount > 0 ? `
                            <button id="clear-checked-btn" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors">
                                Abgehakte entfernen
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow p-4">
                    <div class="w-full bg-gray-200 rounded-full h-3">
                        <div class="bg-green-500 h-3 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                    </div>
                </div>

                <div class="bg-white rounded-lg shadow">
                    <div class="divide-y">
                        ${this.shoppingList.map((item, index) => `
                            <div class="p-4 hover:bg-gray-50 transition-colors cursor-pointer ${item.checked ? 'opacity-50' : ''}"
                                 data-item-index="${index}">
                                <div class="flex items-start gap-3">
                                    <input type="checkbox" ${item.checked ? 'checked' : ''}
                                           class="item-checkbox mt-1 w-5 h-5 cursor-pointer"
                                           data-item-index="${index}">
                                    <div class="flex-1">
                                        <p class="font-medium ${item.checked ? 'line-through' : ''}">
                                            ${item.amount} ${item.unit} ${item.name}
                                        </p>
                                        <p class="text-sm text-gray-500 mt-1">
                                            Für: ${item.recipeNames.join(', ')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p class="text-sm text-blue-800">
                        <strong>Tipp:</strong> Klicke auf einen Artikel, um ihn als erledigt zu markieren.
                        Du kannst die Liste exportieren oder in die Zwischenablage kopieren.
                    </p>
                </div>
            </div>
        `;
    },

    generateShoppingList() {
        if (!AppState.weekPlan) {
            this.shoppingList = [];
            return;
        }

        const ingredientsMap = new Map();

        AppState.weekPlan.days.forEach(day => {
            Object.values(day.meals).forEach(meal => {
                if (meal?.recipeId) {
                    const recipe = StorageService.getRecipeById(meal.recipeId);
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
                                    checked: false,
                                    recipeNames: [recipe.name]
                                });
                            }
                        });
                    }
                }
            });
        });

        this.shoppingList = Array.from(ingredientsMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name)
        );
    },

    attachEventListeners() {
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
    },

    copyToClipboard() {
        const text = this.shoppingList
            .map(item => `${item.amount} ${item.unit} ${item.name}`)
            .join('\n');

        navigator.clipboard.writeText(text).then(() => {
            alert('Einkaufsliste in die Zwischenablage kopiert!');
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
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
