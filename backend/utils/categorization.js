/**
 * Ingredient categorization utilities
 */

// Category definitions
const CATEGORIES = {
    FRUITS_VEGGIES: 'Obst & Gemüse',
    DAIRY: 'Milchprodukte',
    MEAT_FISH: 'Fleisch & Fisch',
    DRY_GOODS: 'Trockenwaren',
    FROZEN: 'Tiefkühl',
    OTHER: 'Sonstiges'
};

// Keyword mappings for categorization
const CATEGORY_KEYWORDS = {
    [CATEGORIES.FRUITS_VEGGIES]: [
        'apfel', 'birne', 'banane', 'orange', 'zitrone', 'erdbeere', 'himbeere', 'blaubeere', 'traube', 'melone',
        'tomate', 'gurke', 'paprika', 'zwiebel', 'knoblauch', 'kartoffel', 'karotte', 'möhre', 'salat', 'spinat',
        'brokkoli', 'blumenkohl', 'kohl', 'zucchini', 'aubergine', 'kürbis', 'sellerie', 'lauch', 'radieschen',
        'pilz', 'champignon', 'petersilie', 'basilikum', 'thymian', 'rosmarin', 'koriander', 'schnittlauch',
        'avocado', 'mango', 'ananas', 'kiwi', 'pfirsich', 'pflaume', 'kirsche', 'gemüse', 'obst'
    ],
    [CATEGORIES.DAIRY]: [
        'milch', 'sahne', 'butter', 'käse', 'joghurt', 'quark', 'schmand', 'crème', 'mascarpone',
        'mozzarella', 'parmesan', 'gouda', 'feta', 'ricotta', 'frischkäse', 'schlagsahne'
    ],
    [CATEGORIES.MEAT_FISH]: [
        'fleisch', 'huhn', 'hähnchen', 'pute', 'rind', 'schwein', 'lamm', 'hack', 'wurst', 'schinken',
        'speck', 'fisch', 'lachs', 'thunfisch', 'forelle', 'kabeljau', 'garnele', 'shrimp', 'muschel',
        'steak', 'schnitzel', 'filet', 'bacon', 'salami'
    ],
    [CATEGORIES.DRY_GOODS]: [
        'mehl', 'zucker', 'salz', 'pfeffer', 'reis', 'nudel', 'pasta', 'spaghetti', 'linsen', 'bohnen',
        'kichererbsen', 'hafer', 'müsli', 'cornflakes', 'honig', 'marmelade', 'öl', 'essig', 'gewürz',
        'backpulver', 'hefe', 'vanille', 'zimt', 'kakao', 'schokolade', 'nuss', 'mandel', 'walnuss',
        'haselnuss', 'rosine', 'dattel', 'couscous', 'quinoa', 'bulgur', 'kaffee', 'tee'
    ],
    [CATEGORIES.FROZEN]: [
        'tiefkühl', 'gefroren', 'tk-', 'erbsen', 'mais', 'eis', 'eiscreme'
    ]
};

/**
 * Categorizes an ingredient based on its name using rule-based matching
 * @param {string} ingredient - The ingredient name to categorize
 * @returns {string} The category name
 */
function categorizeIngredient(ingredient) {
    const lowerIngredient = ingredient.toLowerCase();

    // Check each category's keywords
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lowerIngredient.includes(keyword)) {
                return category;
            }
        }
    }

    // Default to Other
    return CATEGORIES.OTHER;
}

/**
 * Get all valid category names
 * @returns {string[]} Array of category names
 */
function getValidCategories() {
    return Object.values(CATEGORIES);
}

module.exports = {
    CATEGORIES,
    CATEGORY_KEYWORDS,
    categorizeIngredient,
    getValidCategories
};
