// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : '/api';

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

        // Create toast
        const toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-4 z-50 animate-slide-up`;

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
    }
};

// App State
const AppState = {
    currentView: 'planner',
    recipes: [],
    weekPlan: null,
    currentWeekStart: null, // Track the current week being viewed
    weekPlansCache: {}, // Cache for multiple week plans

    async init() {
        this.recipes = await StorageService.getRecipes();
        // Set current week to Monday of current week
        this.currentWeekStart = DateUtils.getMonday(new Date());
        await this.loadWeekPlan(this.currentWeekStart);
    },

    async loadWeekPlan(weekStart) {
        const weekId = DateUtils.getWeekId(weekStart);

        // Check cache first
        if (this.weekPlansCache[weekId]) {
            this.weekPlan = this.weekPlansCache[weekId];
            return;
        }

        // Try to load from server
        const savedPlan = await StorageService.getWeekPlanByDate(weekStart);
        if (savedPlan) {
            this.weekPlan = savedPlan;
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
        this.recipes = await StorageService.getRecipes();
        // Reload current week
        const weekId = DateUtils.getWeekId(this.currentWeekStart);
        delete this.weekPlansCache[weekId]; // Clear cache for this week
        await this.loadWeekPlan(this.currentWeekStart);
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
            { id: 'ai-recipes', label: '🤖 KI Rezepte' },
            { id: 'parser', label: '📝 Parser' },
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
            case 'ai-recipes':
                return AIRecipeGeneratorView.render();
            case 'parser':
                return RecipeParserView.render();
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
        } else if (AppState.currentView === 'ai-recipes') {
            AIRecipeGeneratorView.attachEventListeners();
        } else if (AppState.currentView === 'parser') {
            RecipeParserView.attachEventListeners();
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
        if (!AppState.weekPlan || !AppState.currentWeekStart) {
            return '<div class="text-gray-800 dark:text-gray-200">Lade Wochenplan...</div>';
        }

        const mealTypes = ['Frühstück', 'Mittagessen', 'Abendessen'];
        const weekRange = DateUtils.formatWeekRange(AppState.currentWeekStart);
        const isCurrentWeek = AppState.isCurrentWeek();

        return `
            <div class="space-y-6">
                <div class="flex justify-between items-center flex-wrap gap-3">
                    <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Wochenplan</h2>
                    <div class="flex gap-2 flex-wrap">
                        <button id="save-template-btn" class="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors">
                            Als Vorlage speichern
                        </button>
                        <button id="load-template-btn" class="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded hover:bg-green-600 dark:hover:bg-green-700 transition-colors">
                            Aus Vorlage laden
                        </button>
                        <button id="reset-week-btn" class="px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded hover:bg-red-600 dark:hover:bg-red-700 transition-colors">
                            Zurücksetzen
                        </button>
                    </div>
                </div>

                <!-- Week Navigation -->
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-4 transition-colors duration-200">
                    <div class="flex items-center justify-between">
                        <button id="prev-week-btn" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Vorherige Woche">
                            <svg class="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                            </svg>
                        </button>
                        <div class="text-center">
                            <h3 class="text-xl font-semibold text-gray-800 dark:text-white">${weekRange}</h3>
                            ${!isCurrentWeek ? `
                                <button id="go-to-current-week-btn" class="mt-1 text-sm text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-500 transition-colors">
                                    Zur aktuellen Woche
                                </button>
                            ` : '<span class="mt-1 text-sm text-green-600 dark:text-green-400">Aktuelle Woche</span>'}
                        </div>
                        <button id="next-week-btn" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Nächste Woche">
                            <svg class="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="grid gap-4">
                    ${AppState.weekPlan.days.map((day, dayIndex) => this.renderDay(day, dayIndex, mealTypes)).join('')}
                </div>

                ${this.renderRecipeSelector()}
                ${this.renderSaveTemplateModal()}
                ${this.renderLoadTemplateModal()}
            </div>
        `;
    },

    renderDay(day, dayIndex, mealTypes) {
        const dayDate = new Date(day.date);
        const formattedDate = DateUtils.formatDateWithDay(dayDate);
        const isToday = DateUtils.isToday(dayDate);
        const isPast = DateUtils.isPast(dayDate);

        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-4 transition-colors duration-200 ${isToday ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} ${isPast ? 'opacity-75' : ''}">
                <div class="flex items-center gap-2 mb-3">
                    <h3 class="text-xl font-semibold text-gray-800 dark:text-white">${formattedDate}</h3>
                    ${isToday ? '<span class="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">Heute</span>' : ''}
                </div>
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

    attachEventListeners() {
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
        delete AppState.weekPlan.days[dayIndex].meals[mealType];
        await StorageService.saveWeekPlan(AppState.weekPlan);
        // Update cache
        const weekId = DateUtils.getWeekId(AppState.currentWeekStart);
        AppState.weekPlansCache[weekId] = AppState.weekPlan;
        App.render();
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
    }
};

// Recipe Database View
const RecipeDatabaseView = {
    editingRecipe: null,
    ingredients: [{ name: '', amount: '', unit: '', category: 'Sonstiges' }],
    tags: [],
    searchQuery: '',
    selectedTags: [],
    categories: ['Obst & Gemüse', 'Milchprodukte', 'Fleisch & Fisch', 'Trockenwaren', 'Tiefkühl', 'Sonstiges'],
    availableTags: ['vegetarisch', 'vegan', 'glutenfrei', 'laktosefrei', 'schnell', 'günstig', 'meal-prep', 'Frühling', 'Sommer', 'Herbst', 'Winter'],
    scalingRecipe: null,
    scaledIngredients: null,
    newServings: null,
    isScaling: false,
    categoryCache: new Map(), // Local cache for ingredient categories

    render() {
        const filteredRecipes = this.filterRecipes();

        return `
            <div class="space-y-6">
                <div class="flex justify-between items-center">
                    <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Rezeptdatenbank</h2>
                    <button id="new-recipe-btn" class="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors">
                        + Neues Rezept
                    </button>
                </div>

                ${AppState.recipes.length > 0 ? `
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-4 transition-colors duration-200">
                        <div class="relative">
                            <input
                                type="text"
                                id="recipe-search-input"
                                value="${this.searchQuery}"
                                placeholder="Rezepte durchsuchen (Name, Kategorie, Zutaten)..."
                                class="w-full px-4 py-2 pl-10 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                            />
                            <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                            ${this.searchQuery ? `
                                <button id="clear-search-btn" class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                </button>
                            ` : ''}
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
                        <p class="text-gray-500 dark:text-gray-400">Noch keine Rezepte vorhanden.</p>
                        <p class="text-gray-400 dark:text-gray-500 text-sm mt-2">Erstelle dein erstes Rezept!</p>
                    </div>
                ` : filteredRecipes.length === 0 ? `
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-8 text-center transition-colors duration-200">
                        <p class="text-gray-500 dark:text-gray-400">Keine Rezepte gefunden.</p>
                        <p class="text-gray-400 dark:text-gray-500 text-sm mt-2">Versuche einen anderen Suchbegriff.</p>
                    </div>
                ` : `
                    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${AppState.recipes.map(recipe => `
                            <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-4 hover:shadow-lg dark:hover:shadow-gray-900 transition-all duration-200">
                                <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">${recipe.name}</h3>
                                ${recipe.category ? `
                                    <span class="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs rounded mb-2">
                                        ${recipe.category}
                                    </span>
                                ` : ''}
                                ${recipe.tags && recipe.tags.length > 0 ? `
                                    <div class="flex flex-wrap gap-1 mb-2">
                                        ${recipe.tags.map(tag => `
                                            <span class="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 text-xs rounded-full">
                                                ${tag}
                                            </span>
                                        `).join('')}
                                    </div>
                                ` : ''}
                                ${recipe.servings ? `<p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Portionen: ${recipe.servings}</p>` : ''}
                                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    ${recipe.ingredients.length} Zutat${recipe.ingredients.length !== 1 ? 'en' : ''}
                                </p>
                                <div class="flex flex-col gap-2">
                                    ${recipe.servings && recipe.ingredients.length > 0 ? `
                                        <button class="scale-portions-btn w-full px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors text-sm"
                                                data-recipe-id="${recipe.id}">
                                            🔢 Portionen anpassen
                                        </button>
                                    ` : ''}
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
                ${this.renderPortionScalingModal()}
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

        // Scale portions buttons
        document.querySelectorAll('.scale-portions-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const recipeId = e.target.dataset.recipeId;
                await this.showPortionScaling(recipeId);
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
            tags: this.tags
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
                    <h2 class="text-3xl font-bold mb-2">🤖 KI Rezept-Generator</h2>
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
    parsedRecipe: null,
    isLoading: false,
    isUrl: false,

    render() {
        return `
            <div class="max-w-6xl mx-auto p-6">
                <h2 class="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">📝 Rezept Parser</h2>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- Input Section -->
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h3 class="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Rezept eingeben</h3>
                        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            🔗 URL einer Rezeptseite ODER 📝 Rezepttext (von WhatsApp, E-Mail, etc.)
                        </p>

                        <textarea
                            id="recipe-input"
                            class="w-full h-96 p-4 border dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            placeholder="Option 1 - URL einfügen:\nhttps://www.chefkoch.de/rezepte/...\n\nOption 2 - Rezepttext einfügen:\n\nSpaghetti Carbonara\n\nZutaten:\n- 400g Spaghetti\n- 200g Speck\n- 4 Eier\n- 100g Parmesan\n- Salz, Pfeffer\n\nZubereitung:\n1. Nudeln kochen...\n2. Speck anbraten..."
                        >${this.inputText}</textarea>

                        <button
                            id="parse-recipe-btn"
                            class="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            ${this.isLoading ? 'disabled' : ''}
                        >
                            ${this.isLoading ? (this.isUrl ? '🔄 URL wird geladen...' : '🔄 Wird geparst...') : '🤖 Rezept parsen'}
                        </button>
                    </div>

                    <!-- Output Section -->
                    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                        <h3 class="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Geparste Daten</h3>

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

    attachEventListeners() {
        // Input textarea
        const input = document.getElementById('recipe-input');
        if (input) {
            input.addEventListener('input', (e) => {
                this.inputText = e.target.value;
            });
        }

        // Parse button
        const parseBtn = document.getElementById('parse-recipe-btn');
        if (parseBtn) {
            parseBtn.addEventListener('click', () => this.parseRecipe());
        }

        // Save button
        const saveBtn = document.getElementById('save-parsed-recipe-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveParsedRecipe());
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
            this.parsedRecipe = null;
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

                <div class="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-4 transition-colors duration-200">
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div class="bg-green-500 dark:bg-green-600 h-3 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
                    </div>
                </div>

                ${this.renderCategorizedList()}

                <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 transition-colors duration-200">
                    <p class="text-sm text-blue-800 dark:text-blue-300">
                        <strong>Tipp:</strong> Klicke auf einen Artikel, um ihn als erledigt zu markieren.
                        Du kannst die Liste exportieren oder in die Zwischenablage kopieren.
                    </p>
                </div>

                ${this.renderAddManualItemModal()}
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
                            <div class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${item.checked ? 'opacity-50' : ''} ${item.isManual ? 'border-l-4 border-green-500 dark:border-green-600' : ''}">
                                <div class="flex items-start gap-3">
                                    <input type="checkbox" ${item.checked ? 'checked' : ''}
                                           class="item-checkbox mt-1 w-5 h-5 cursor-pointer accent-blue-500 dark:accent-blue-400"
                                           data-item-index="${item.index}">
                                    <div class="flex-1 cursor-pointer" data-item-index="${item.index}">
                                        <div class="flex items-start justify-between gap-2">
                                            <p class="font-medium text-gray-800 dark:text-white ${item.checked ? 'line-through' : ''}">
                                                ${item.amount} ${item.unit} ${item.name}
                                                ${item.isManual ? '<span class="ml-2 text-xs bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 px-2 py-0.5 rounded">Manuell</span>' : ''}
                                            </p>
                                            ${item.isManual ? `
                                                <button class="delete-manual-item-btn text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-600 text-sm px-2"
                                                        data-item-id="${item.id}"
                                                        title="Artikel löschen">
                                                    ✕
                                                </button>
                                            ` : ''}
                                        </div>
                                        ${item.recipeNames.length > 0 ? `
                                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
