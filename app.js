// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : '/api';

// Toast Notification Manager
const Toast = {
    show(message, options = {}) {
        const { duration = 10000, showUndo = false, onUndo = null } = options;

        // Remove existing toast
        const existingToast = document.getElementById('toast-notification');
        if (existingToast) existingToast.remove();

        // Create toast
        const toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'fixed bottom-4 right-4 bg-gray-800 dark:bg-gray-700 text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-4 z-50 animate-slide-up';

        toast.innerHTML = `
            <span class="flex-1">${message}</span>
            ${showUndo ? `
                <button id="toast-undo-btn" class="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded transition-colors font-medium">
                    Rückgängig
                </button>
            ` : ''}
            <button id="toast-close-btn" class="text-gray-400 hover:text-white text-xl">✕</button>
        `;

        document.body.appendChild(toast);

        // Attach event listeners
        const closeBtn = toast.querySelector('#toast-close-btn');
        const undoBtn = toast.querySelector('#toast-undo-btn');

        const close = () => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 200);
        };

        closeBtn.addEventListener('click', close);

        if (undoBtn && onUndo) {
            undoBtn.addEventListener('click', () => {
                onUndo();
                close();
            });
        }

        // Auto close after duration
        setTimeout(close, duration);
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

// Storage Service with API integration
const StorageService = {
    async getRecipes() {
        try {
            const response = await fetch(`${API_BASE_URL}/recipes`);
            if (!response.ok) throw new Error('Failed to fetch recipes');
            return await response.json();
        } catch (error) {
            console.error('Error fetching recipes:', error);
            return [];
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
    }
};

// App State
const AppState = {
    currentView: 'planner',
    recipes: [],
    weekPlan: null,

    async init() {
        this.recipes = await StorageService.getRecipes();
        this.weekPlan = await StorageService.getWeekPlan();
        if (!this.weekPlan) {
            await this.initializeWeekPlan();
        }
    },

    async initializeWeekPlan() {
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

        await StorageService.saveWeekPlan(this.weekPlan);
    },

    setView(view) {
        this.currentView = view;
        App.render();
    },

    async reloadData() {
        this.recipes = await StorageService.getRecipes();
        this.weekPlan = await StorageService.getWeekPlan();
    }
};

// Main App
const App = {
    async init() {
        DarkMode.init();
        await AppState.init();
        this.render();
        this.setupKeyboardShortcuts();
    },

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Z or Cmd+Z for undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                ActionHistory.undo();
            }
        });
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
        const isDark = document.documentElement.classList.contains('dark');
        const sunIconClass = isDark ? 'hidden' : '';
        const moonIconClass = isDark ? '' : 'hidden';

        return `
            <header class="bg-white dark:bg-gray-800 shadow-md transition-colors duration-200">
                <div class="container mx-auto px-4 py-4">
                    <div class="flex justify-between items-center">
                        <div>
                            <h1 class="text-3xl font-bold text-gray-800 dark:text-white">Food Planner</h1>
                            <p class="text-gray-600 dark:text-gray-300">Dein persönlicher Essenswochenplaner</p>
                        </div>
                        <button id="dark-mode-toggle" class="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" title="Dark Mode umschalten">
                            <svg class="w-6 h-6 text-gray-800 dark:text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path class="${sunIconClass}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
                                <path class="${moonIconClass}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
                            </svg>
                        </button>
                    </div>
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
            <nav class="bg-white dark:bg-gray-800 border-b dark:border-gray-700 transition-colors duration-200">
                <div class="container mx-auto px-4">
                    <div class="flex space-x-1">
                        ${tabs.map(tab => `
                            <button
                                class="nav-btn px-6 py-3 font-medium transition-colors ${
                                    AppState.currentView === tab.id
                                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                                        : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
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
        // Dark mode toggle
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', () => {
                DarkMode.toggle();
                App.render();
            });
        }

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
            return '<div class="text-gray-800 dark:text-gray-200">Lade Wochenplan...</div>';
        }

        const mealTypes = ['Frühstück', 'Mittagessen', 'Abendessen'];

        return `
            <div class="space-y-6">
                <div class="flex justify-between items-center">
                    <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Wochenplan</h2>
                    <button id="reset-week-btn" class="px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded hover:bg-red-600 dark:hover:bg-red-700 transition-colors">
                        Plan zurücksetzen
                    </button>
                </div>

                <div class="grid gap-4">
                    ${AppState.weekPlan.days.map((day, dayIndex) => `
                        <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-4 transition-colors duration-200">
                            <h3 class="text-xl font-semibold text-gray-800 dark:text-white mb-3">${day.dayName}</h3>
                            <div class="grid md:grid-cols-3 gap-3">
                                ${mealTypes.map(mealType => {
                                    const meal = day.meals[mealType];
                                    return `
                                        <div class="border dark:border-gray-700 rounded p-3">
                                            <div class="flex justify-between items-center mb-2">
                                                <h4 class="font-medium text-gray-700 dark:text-gray-300">${mealType}</h4>
                                                ${meal ? `
                                                    <button class="remove-meal-btn text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-600 text-sm"
                                                            data-day="${dayIndex}"
                                                            data-meal="${mealType}">
                                                        ✕
                                                    </button>
                                                ` : ''}
                                            </div>
                                            ${meal ? `
                                                <div class="bg-blue-50 dark:bg-blue-900/30 p-2 rounded">
                                                    <p class="text-sm text-gray-800 dark:text-gray-200">${meal.recipeName}</p>
                                                </div>
                                            ` : `
                                                <button class="add-meal-btn w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
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

    attachEventListeners() {
        // Reset week plan
        const resetBtn = document.getElementById('reset-week-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                if (confirm('Möchtest du den Wochenplan wirklich zurücksetzen?')) {
                    // Save current week plan before resetting
                    const oldWeekPlan = JSON.parse(JSON.stringify(AppState.weekPlan));

                    // Reset week plan
                    await AppState.initializeWeekPlan();
                    App.render();

                    // Show toast with undo option
                    Toast.show('Wochenplan zurückgesetzt', {
                        showUndo: true,
                        onUndo: async () => {
                            await StorageService.saveWeekPlan(oldWeekPlan);
                            await AppState.reloadData();
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
                this.selectedDay = parseInt(e.target.dataset.day);
                this.selectedMealType = e.target.dataset.meal;
                this.showRecipeSelector();
            });
        });

        // Remove meal buttons
        document.querySelectorAll('.remove-meal-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const dayIndex = parseInt(e.target.dataset.day);
                const mealType = e.target.dataset.meal;
                await this.removeMeal(dayIndex, mealType);
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
        this.hideRecipeSelector();
        App.render();
    },

    async removeMeal(dayIndex, mealType) {
        delete AppState.weekPlan.days[dayIndex].meals[mealType];
        await StorageService.saveWeekPlan(AppState.weekPlan);
        App.render();
    }
};

// Recipe Database View
const RecipeDatabaseView = {
    editingRecipe: null,
    ingredients: [{ name: '', amount: '', unit: '' }],
    searchQuery: '',

    render() {
        const filteredRecipes = this.filterRecipes();

        return `
            <div class="space-y-6">
                <div class="flex justify-between items-center">
                    <h2 class="text-2xl font-bold text-gray-800">Rezeptdatenbank</h2>
                    <button id="new-recipe-btn" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                        + Neues Rezept
                    </button>
                </div>

                ${AppState.recipes.length > 0 ? `
                    <div class="bg-white rounded-lg shadow p-4">
                        <div class="relative">
                            <input
                                type="text"
                                id="recipe-search-input"
                                value="${this.searchQuery}"
                                placeholder="Rezepte durchsuchen (Name, Kategorie, Zutaten)..."
                                class="w-full px-4 py-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                            ${this.searchQuery ? `
                                <button id="clear-search-btn" class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                        ${this.searchQuery ? `
                            <p class="text-sm text-gray-600 mt-2">
                                ${filteredRecipes.length} von ${AppState.recipes.length} Rezept${filteredRecipes.length !== 1 ? 'en' : ''} gefunden
                            </p>
                        ` : ''}
                    </div>
                ` : ''}

                ${AppState.recipes.length === 0 ? `
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-8 text-center transition-colors duration-200">
                        <p class="text-gray-500 dark:text-gray-400">Noch keine Rezepte vorhanden.</p>
                        <p class="text-gray-400 dark:text-gray-500 text-sm mt-2">Erstelle dein erstes Rezept!</p>
                    </div>
                ` : filteredRecipes.length === 0 ? `
                    <div class="bg-white rounded-lg shadow p-8 text-center">
                        <p class="text-gray-500">Keine Rezepte gefunden.</p>
                        <p class="text-gray-400 text-sm mt-2">Versuche einen anderen Suchbegriff.</p>
                    </div>
                ` : `
                    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${AppState.recipes.map(recipe => `
                            <div class="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow">
                                <h3 class="text-lg font-semibold text-gray-800 mb-2">${recipe.name}</h3>
                                ${recipe.category ? `
                                    <span class="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs rounded mb-2">
                                        ${recipe.category}
                                    </span>
                                ` : ''}
                                ${recipe.servings ? `<p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Portionen: ${recipe.servings}</p>` : ''}
                                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    ${recipe.ingredients.length} Zutat${recipe.ingredients.length !== 1 ? 'en' : ''}
                                </p>
                                <div class="flex flex-col gap-2">
                                    <div class="flex gap-2">
                                        <button class="edit-recipe-btn flex-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                                                data-recipe-id="${recipe.id}">
                                            Bearbeiten
                                        </button>
                                        <button class="delete-recipe-btn px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm"
                                                data-recipe-id="${recipe.id}">
                                            Löschen
                                        </button>
                                    </div>
                                    <button class="duplicate-recipe-btn w-full px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm"
                                            data-recipe-id="${recipe.id}">
                                        ✓ Duplizieren
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
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
                    <div class="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                        <h3 class="text-xl font-semibold text-gray-800 dark:text-white">
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
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zubereitung</label>
                                <textarea id="recipe-instructions" rows="5" placeholder="Beschreibe die Zubereitungsschritte..."
                                          class="w-full px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"></textarea>
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
                App.render();
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

        // New recipe button
        const newBtn = document.getElementById('new-recipe-btn');
        if (newBtn) {
            newBtn.addEventListener('click', () => this.showRecipeForm());
        }

        // Edit recipe buttons
        document.querySelectorAll('.edit-recipe-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const recipeId = e.target.dataset.recipeId;
                await this.editRecipe(recipeId);
            });
        });

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
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveRecipe();
            });
        }

        this.renderIngredients();
    },

    filterRecipes() {
        if (!this.searchQuery.trim()) {
            return AppState.recipes;
        }

        const query = this.searchQuery.toLowerCase().trim();

        return AppState.recipes.filter(recipe => {
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

    renderIngredients() {
        const container = document.getElementById('ingredients-container');
        if (!container) return;

        container.innerHTML = this.ingredients.map((ing, index) => `
            <div class="flex gap-2 mb-2">
                <input type="text" placeholder="Zutat" value="${ing.name}" data-index="${index}" data-field="name"
                       class="ingredient-input flex-1 px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                <input type="text" placeholder="Menge" value="${ing.amount}" data-index="${index}" data-field="amount"
                       class="ingredient-input w-24 px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                <input type="text" placeholder="Einheit" value="${ing.unit}" data-index="${index}" data-field="unit"
                       class="ingredient-input w-24 px-3 py-2 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400">
                <button type="button" class="remove-ingredient-btn px-3 py-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300" data-index="${index}">
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

    async editRecipe(recipeId) {
        const recipe = await StorageService.getRecipeById(recipeId);
        if (recipe) {
            this.showRecipeForm(recipe);
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

            // Show toast with undo option
            Toast.show(`Rezept "${recipe.name}" gelöscht`, {
                showUndo: true,
                onUndo: async () => {
                    await StorageService.addRecipe(recipe);
                    await AppState.reloadData();
                    App.render();
                    Toast.show(`Rezept "${recipe.name}" wiederhergestellt`);
                }
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

        await StorageService.addRecipe(duplicatedRecipe);
        await AppState.reloadData();

        // Open the duplicated recipe in edit mode
        this.showRecipeForm(duplicatedRecipe);
    },

    async saveRecipe() {
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
            await StorageService.updateRecipe(recipe);
        } else {
            await StorageService.addRecipe(recipe);
        }

        await AppState.reloadData();
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
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-8 text-center transition-colors duration-200">
                    <p class="text-gray-500 dark:text-gray-400">Keine Zutaten im Wochenplan.</p>
                    <p class="text-gray-400 dark:text-gray-500 text-sm mt-2">
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
                        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Einkaufsliste</h2>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            ${checkedCount} von ${this.shoppingList.length} Artikel${this.shoppingList.length !== 1 ? 'n' : ''} abgehakt
                        </p>
                    </div>
                    <div class="flex gap-2">
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

                <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-4 transition-colors duration-200">
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div class="bg-green-500 dark:bg-green-600 h-3 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                    </div>
                </div>

                <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 transition-colors duration-200">
                    <div class="divide-y dark:divide-gray-700">
                        ${this.shoppingList.map((item, index) => `
                            <div class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${item.checked ? 'opacity-50' : ''}"
                                 data-item-index="${index}">
                                <div class="flex items-start gap-3">
                                    <input type="checkbox" ${item.checked ? 'checked' : ''}
                                           class="item-checkbox mt-1 w-5 h-5 cursor-pointer accent-blue-500 dark:accent-blue-400"
                                           data-item-index="${index}">
                                    <div class="flex-1">
                                        <p class="font-medium text-gray-800 dark:text-white ${item.checked ? 'line-through' : ''}">
                                            ${item.amount} ${item.unit} ${item.name}
                                        </p>
                                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                            Für: ${item.recipeNames.join(', ')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 transition-colors duration-200">
                    <p class="text-sm text-blue-800 dark:text-blue-300">
                        <strong>Tipp:</strong> Klicke auf einen Artikel, um ihn als erledigt zu markieren.
                        Du kannst die Liste exportieren oder in die Zwischenablage kopieren.
                    </p>
                </div>
            </div>
        `;
    },

    async generateShoppingList() {
        if (!AppState.weekPlan) {
            this.shoppingList = [];
            return;
        }

        const ingredientsMap = new Map();

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
                                    checked: false,
                                    recipeNames: [recipe.name]
                                });
                            }
                        });
                    }
                }
            }
        }

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
