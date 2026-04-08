// API Configuration — always use same origin (proxied via nginx)
export const API_BASE_URL = '';

// Token refresh interval in ms (access token lives 15 minutes)
export const TOKEN_REFRESH_INTERVAL = 12 * 60 * 1000;

// Ingredient categories used by backend and frontend
export const INGREDIENT_CATEGORIES = [
    'Obst & Gemüse',
    'Milchprodukte',
    'Fleisch & Fisch',
    'Trockenwaren',
    'Tiefkühl',
    'Sonstiges'
];

// Supermarket department definitions with default order
export const DEFAULT_DEPARTMENTS = [
    { id: 'fruits_veggies', emoji: '🥬', name: 'Obst & Gemüse' },
    { id: 'bread', emoji: '🍞', name: 'Brot & Backwaren' },
    { id: 'dairy', emoji: '🥛', name: 'Milch & Molkerei' },
    { id: 'eggs', emoji: '🥚', name: 'Eier' },
    { id: 'meat_fish', emoji: '🥩', name: 'Fleisch & Fisch' },
    { id: 'cheese_deli', emoji: '🧀', name: 'Käse & Aufschnitt' },
    { id: 'canned', emoji: '🥫', name: 'Konserven & Gläser' },
    { id: 'dry_goods', emoji: '🌾', name: 'Trockenware & Pasta' },
    { id: 'frozen', emoji: '❄️', name: 'Tiefkühlkost' },
    { id: 'household', emoji: '🧴', name: 'Pflege & Haushalt' },
    { id: 'other', emoji: '📦', name: 'Sonstiges' }
];

// Mapping from backend ingredient categories to department IDs
export const CATEGORY_TO_DEPARTMENT = {
    'Obst & Gemüse': 'fruits_veggies',
    'Milchprodukte': 'dairy',
    'Fleisch & Fisch': 'meat_fish',
    'Trockenwaren': 'dry_goods',
    'Tiefkühl': 'frozen',
    'Sonstiges': 'other'
};
