import { API_BASE_URL } from '../config.js';
import { OfflineDB } from './offline-db.js';
import { PWA } from './pwa.js';
import { Toast } from './toast.js';
import { api } from './api.js';

// Storage Service with API integration and offline support
export const StorageService = {
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
            const payload = await api(url);
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
            return await api.put(`${API_BASE_URL}/recipes/${recipeId}/favorite`, { isFavorite });
        } catch (error) {
            console.error('Error toggling favorite:', error);
            throw error;
        }
    },

    async addRecipe(recipe) {
        try {
            return await api.post(`${API_BASE_URL}/recipes`, recipe);
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
            return await api.put(`${API_BASE_URL}/recipes/${recipe.id}`, recipe);
        } catch (error) {
            console.error('Error updating recipe:', error);
            throw error;
        }
    },

    async deleteRecipe(id) {
        try {
            return await api.delete(`${API_BASE_URL}/recipes/${id}`);
        } catch (error) {
            console.error('Error deleting recipe:', error);
            throw error;
        }
    },

    async getRecipeById(id) {
        try {
            return await api.get(`${API_BASE_URL}/recipes/${id}`);
        } catch (error) {
            console.error('Error fetching recipe:', error);
            return null;
        }
    },

    async getWeekPlan() {
        try {
            return await api.get(`${API_BASE_URL}/weekplan`);
        } catch (error) {
            console.error('Error fetching week plan:', error);
            return null;
        }
    },

    async getWeekPlanByDate(date) {
        try {
            const isoDate = new Date(date).toISOString().split('T')[0];
            const response = await api(`${API_BASE_URL}/weekplan/by-date/${isoDate}`, {}, { raw: true });
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
            return await api.post(`${API_BASE_URL}/weekplan`, weekPlan);
        } catch (error) {
            console.error('Error saving week plan:', error);
            throw error;
        }
    },

    async clearWeekPlan() {
        try {
            return await api.delete(`${API_BASE_URL}/weekplan`);
        } catch (error) {
            console.error('Error clearing week plan:', error);
            throw error;
        }
    },

    // Template methods
    async getTemplates() {
        try {
            return await api.get(`${API_BASE_URL}/weekplan/templates`);
        } catch (error) {
            console.error('Error fetching templates:', error);
            return [];
        }
    },

    async getTemplateById(id) {
        try {
            return await api.get(`${API_BASE_URL}/weekplan/templates/${id}`);
        } catch (error) {
            console.error('Error fetching template:', error);
            return null;
        }
    },

    async saveTemplate(template) {
        try {
            return await api.post(`${API_BASE_URL}/weekplan/templates`, template);
        } catch (error) {
            console.error('Error saving template:', error);
            throw error;
        }
    },

    async updateTemplate(id, template) {
        try {
            return await api.put(`${API_BASE_URL}/weekplan/templates/${id}`, template);
        } catch (error) {
            console.error('Error updating template:', error);
            throw error;
        }
    },

    async deleteTemplate(id) {
        try {
            return await api.delete(`${API_BASE_URL}/weekplan/templates/${id}`);
        } catch (error) {
            console.error('Error deleting template:', error);
            throw error;
        }
    },

    // Manual shopping items methods
    async getManualShoppingItems() {
        try {
            return await api.get(`${API_BASE_URL}/shopping/manual`);
        } catch (error) {
            console.error('Error fetching manual shopping items:', error);
            return [];
        }
    },

    async addManualShoppingItem(item) {
        try {
            return await api.post(`${API_BASE_URL}/shopping/manual`, item);
        } catch (error) {
            console.error('Error adding manual shopping item:', error);
            throw error;
        }
    },

    async deleteManualShoppingItem(id) {
        try {
            return await api.delete(`${API_BASE_URL}/shopping/manual/${id}`);
        } catch (error) {
            console.error('Error deleting manual shopping item:', error);
            throw error;
        }
    },

    async clearManualShoppingItems() {
        try {
            return await api.delete(`${API_BASE_URL}/shopping/manual`);
        } catch (error) {
            console.error('Error clearing manual shopping items:', error);
            throw error;
        }
    },

    async checkPantryAvailability(items) {
        try {
            return await api.post(`${API_BASE_URL}/shopping/check-pantry`, { items });
        } catch (error) {
            console.error('Error checking pantry availability:', error);
            return { items: [], summary: { totalItems: 0, fullyAvailable: 0, partiallyAvailable: 0, toBuy: 0 } };
        }
    },

    // Cooking History methods
    async getCookingHistory(page = 1, limit = 20) {
        try {
            const data = await api.get(`${API_BASE_URL}/cooking-history?page=${page}&limit=${limit}`);
            return {
                history: data.entries || [],
                total: data.total || 0,
                page,
                totalPages: Math.ceil((data.total || 0) / limit)
            };
        } catch (error) {
            console.error('Error fetching cooking history:', error);
            return { history: [], total: 0, page: 1, totalPages: 0 };
        }
    },

    async getCookingStats() {
        try {
            return await api.get(`${API_BASE_URL}/cooking-history/stats`);
        } catch (error) {
            console.error('Error fetching cooking stats:', error);
            return [];
        }
    },

    async getRecipeCookingHistory(recipeId) {
        try {
            return await api.get(`${API_BASE_URL}/cooking-history/recipe/${recipeId}`);
        } catch (error) {
            console.error('Error fetching recipe cooking history:', error);
            return [];
        }
    },

    async markAsCooked(recipeId, servings = null, notes = null) {
        try {
            return await api.post(`${API_BASE_URL}/cooking-history`, { recipeId, servings, notes });
        } catch (error) {
            console.error('Error marking recipe as cooked:', error);
            throw error;
        }
    },

    async deleteCookingHistoryEntry(id) {
        try {
            return await api.delete(`${API_BASE_URL}/cooking-history/${id}`);
        } catch (error) {
            console.error('Error deleting cooking history entry:', error);
            throw error;
        }
    },

    async getNotCookedRecently(days = 30) {
        try {
            return await api.get(`${API_BASE_URL}/cooking-history/not-cooked-recently?days=${days}`);
        } catch (error) {
            console.error('Error fetching not recently cooked recipes:', error);
            return [];
        }
    },

    // Seasonal methods
    async getSeasonInfo() {
        try {
            return await api.get(`${API_BASE_URL}/seasons`);
        } catch (error) {
            console.error('Error fetching season info:', error);
            return null;
        }
    },

    async getSeasonalIngredients(season = 'current') {
        try {
            return await api.get(`${API_BASE_URL}/seasons/${season}/ingredients`);
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

            return await api.get(url);
        } catch (error) {
            console.error('Error fetching seasonal recipes:', error);
            return { recipes: [], season: '', seasonKey: '' };
        }
    },

    async getSeasonalRecommendations(limit = 6) {
        try {
            return await api.get(`${API_BASE_URL}/recipes/seasonal/recommendations?limit=${limit}`);
        } catch (error) {
            console.error('Error fetching seasonal recommendations:', error);
            return { recommendations: [], season: '', seasonKey: '', topSeasonalIngredients: [] };
        }
    },

    async checkIngredientsInSeason(ingredients, season = null) {
        try {
            return await api.post(`${API_BASE_URL}/seasons/check`, { ingredients, season });
        } catch (error) {
            console.error('Error checking ingredients:', error);
            return { ingredients: [] };
        }
    },

    // AI Recipe Analysis & Variants
    async analyzeRecipe(recipe) {
        try {
            return await api.post(`${API_BASE_URL}/ai/analyze-recipe`, { recipe });
        } catch (error) {
            console.error('Error analyzing recipe:', error);
            throw error;
        }
    },

    async generateRecipeVariant(recipe, variantType) {
        try {
            return await api.post(`${API_BASE_URL}/ai/generate-variant`, { recipe, variantType });
        } catch (error) {
            console.error('Error generating recipe variant:', error);
            throw error;
        }
    },

    async getVariantTypes() {
        try {
            return await api.get(`${API_BASE_URL}/ai/variant-types`);
        } catch (error) {
            console.error('Error getting variant types:', error);
            return { variantTypes: [] };
        }
    },

    async aiSearch(query, recipes) {
        try {
            return await api.post(`${API_BASE_URL}/ai/search`, { query, recipes });
        } catch (error) {
            console.error('Error in AI search:', error);
            throw error;
        }
    },

    async generateMealPrepSuggestions(payload) {
        try {
            return await api.post(`${API_BASE_URL}/ai/meal-prep-suggestions`, payload);
        } catch (error) {
            console.error('Error generating meal-prep suggestions:', error);
            throw error;
        }
    },

    async getPantryItems() {
        try {
            return await api.get(`${API_BASE_URL}/pantry`);
        } catch (error) {
            console.error('Error fetching pantry items:', error);
            return [];
        }
    },

    async addPantryItem(item) {
        return await api.post(`${API_BASE_URL}/pantry`, item);
    },

    async updatePantryItem(item) {
        return await api.put(`${API_BASE_URL}/pantry/${item.id}`, item);
    },

    async deletePantryItem(id) {
        return await api.delete(`${API_BASE_URL}/pantry/${id}`);
    },

    async getExpiringPantryItems(days = 3) {
        try {
            return await api.get(`${API_BASE_URL}/pantry/expiring?days=${days}`);
        } catch (error) {
            console.error('Error fetching expiring pantry items:', error);
            return [];
        }
    }
};
