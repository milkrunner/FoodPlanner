import { StorageService } from './storage-service.js';
import { DateUtils } from './date-utils.js';

// Render callback to break circular dependency with App
let _renderCallback = null;
export function setRenderCallback(fn) { _renderCallback = fn; }

// App State
export const AppState = {
    currentView: 'planner',
    recipes: [],
    weekPlan: null,
    currentWeekStart: null, // Track the current week being viewed
    weekPlansCache: {}, // Cache for multiple week plans
    pantryItems: [],
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
        this.pantryItems = await StorageService.getPantryItems();
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
        _renderCallback?.();
    },

    async goToCurrentWeek() {
        this.currentWeekStart = DateUtils.getMonday(new Date());
        await this.loadWeekPlan(this.currentWeekStart);
        _renderCallback?.();
    },

    isCurrentWeek() {
        const today = DateUtils.getMonday(new Date());
        return this.currentWeekStart.getTime() === today.getTime();
    },

    setView(view) {
        this.currentView = view;
        _renderCallback?.();
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
