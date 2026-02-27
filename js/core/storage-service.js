import { API_BASE_URL } from '../config.js';
import { OfflineDB } from './offline-db.js';
import { PWA } from './pwa.js';
import { Toast } from './toast.js';
import { Auth } from './auth.js';

function authHeaders(extra = {}) {
    return Auth.authHeaders(extra);
}

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
                headers: authHeaders({ 'Content-Type': 'application/json' }),
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
                headers: authHeaders({ 'Content-Type': 'application/json' }),
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
                headers: authHeaders({ 'Content-Type': 'application/json' }),
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
                method: 'DELETE',
                headers: authHeaders()
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
                headers: authHeaders({ 'Content-Type': 'application/json' }),
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
                method: 'DELETE',
                headers: authHeaders()
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
                headers: authHeaders({ 'Content-Type': 'application/json' }),
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
                headers: authHeaders({ 'Content-Type': 'application/json' }),
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
                method: 'DELETE',
                headers: authHeaders()
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
                headers: authHeaders({ 'Content-Type': 'application/json' }),
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
                method: 'DELETE',
                headers: authHeaders()
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
                method: 'DELETE',
                headers: authHeaders()
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
            const data = await response.json();
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
                headers: authHeaders({ 'Content-Type': 'application/json' }),
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
                method: 'DELETE',
                headers: authHeaders()
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
                headers: authHeaders({ 'Content-Type': 'application/json' }),
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
                headers: authHeaders({ 'Content-Type': 'application/json' }),
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
                headers: authHeaders({ 'Content-Type': 'application/json' }),
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
                headers: authHeaders({ 'Content-Type': 'application/json' }),
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
                headers: authHeaders({ 'Content-Type': 'application/json' }),
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
    },

    async getPantryItems() {
        try {
            const response = await fetch(`${API_BASE_URL}/pantry`);
            if (!response.ok) throw new Error('Failed to fetch pantry items');
            return await response.json();
        } catch (error) {
            console.error('Error fetching pantry items:', error);
            return [];
        }
    },

    async addPantryItem(item) {
        const response = await fetch(`${API_BASE_URL}/pantry`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(item)
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to add pantry item');
        }
        return await response.json();
    },

    async updatePantryItem(item) {
        const response = await fetch(`${API_BASE_URL}/pantry/${item.id}`, {
            method: 'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(item)
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to update pantry item');
        }
        return await response.json();
    },

    async deletePantryItem(id) {
        const response = await fetch(`${API_BASE_URL}/pantry/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (!response.ok) throw new Error('Failed to delete pantry item');
        return await response.json();
    },

    async getExpiringPantryItems(days = 3) {
        try {
            const response = await fetch(`${API_BASE_URL}/pantry/expiring?days=${days}`);
            if (!response.ok) throw new Error('Failed to fetch expiring items');
            return await response.json();
        } catch (error) {
            console.error('Error fetching expiring pantry items:', error);
            return [];
        }
    }
};
