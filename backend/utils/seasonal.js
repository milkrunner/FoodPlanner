/**
 * Seasonal calendar and ingredient seasonality utilities
 */

// Seasonal ingredient data - German seasons
const SEASONAL_CALENDAR = {
    // Frühling (März-Mai): 3, 4, 5
    spring: {
        name: 'Frühling',
        months: [3, 4, 5],
        ingredients: [
            'spargel', 'rhabarber', 'bärlauch', 'radieschen', 'spinat', 'rucola',
            'frühlingszwiebel', 'kohlrabi', 'mangold', 'kresse', 'schnittlauch',
            'petersilie', 'erdbeere', 'waldmeister', 'kopfsalat', 'feldsalat',
            'löwenzahn', 'brennnessel', 'sauerampfer', 'minze'
        ]
    },
    // Sommer (Juni-August): 6, 7, 8
    summer: {
        name: 'Sommer',
        months: [6, 7, 8],
        ingredients: [
            'tomate', 'tomaten', 'zucchini', 'gurke', 'paprika', 'aubergine',
            'bohne', 'bohnen', 'erbse', 'erbsen', 'mais', 'fenchel',
            'erdbeere', 'erdbeeren', 'himbeere', 'himbeeren', 'johannisbeere',
            'brombeere', 'heidelbeere', 'blaubeere', 'kirsche', 'kirschen',
            'pfirsich', 'aprikose', 'nektarine', 'melone', 'wassermelone',
            'basilikum', 'oregano', 'thymian', 'rosmarin', 'salbei',
            'mangold', 'salat', 'kopfsalat', 'eisbergsalat', 'lollo'
        ]
    },
    // Herbst (September-November): 9, 10, 11
    autumn: {
        name: 'Herbst',
        months: [9, 10, 11],
        ingredients: [
            'kürbis', 'hokkaido', 'butternut', 'pilz', 'pilze', 'champignon',
            'pfifferling', 'steinpilz', 'apfel', 'birne', 'zwetschge', 'pflaume',
            'traube', 'weintraube', 'quitte', 'kohl', 'weißkohl', 'rotkohl',
            'wirsing', 'grünkohl', 'rosenkohl', 'blumenkohl', 'brokkoli',
            'karotte', 'möhre', 'rote bete', 'sellerie', 'knollensellerie',
            'pastinake', 'kartoffel', 'süßkartoffel', 'maroni', 'kastanie',
            'walnuss', 'haselnuss', 'lauch', 'porree', 'fenchel', 'chinakohl'
        ]
    },
    // Winter (Dezember-Februar): 12, 1, 2
    winter: {
        name: 'Winter',
        months: [12, 1, 2],
        ingredients: [
            'grünkohl', 'rosenkohl', 'wirsing', 'weißkohl', 'rotkohl', 'chinakohl',
            'feldsalat', 'chicorée', 'radicchio', 'endivie', 'schwarzwurzel',
            'topinambur', 'pastinake', 'steckrübe', 'rote bete', 'sellerie',
            'kartoffel', 'karotte', 'möhre', 'lauch', 'porree', 'zwiebel',
            'knoblauch', 'meerrettich', 'apfel', 'birne', 'orange', 'mandarine',
            'clementine', 'grapefruit', 'zitrone', 'granatapfel', 'kaki'
        ]
    }
};

// Get current season based on month
function getCurrentSeason() {
    const month = new Date().getMonth() + 1; // JavaScript months are 0-indexed

    for (const [season, data] of Object.entries(SEASONAL_CALENDAR)) {
        if (data.months.includes(month)) {
            return { key: season, ...data };
        }
    }
    return { key: 'spring', ...SEASONAL_CALENDAR.spring }; // Fallback
}

// Check if an ingredient is in season
function isIngredientInSeason(ingredientName, seasonKey = null) {
    const lowerName = ingredientName.toLowerCase();
    const season = seasonKey ? SEASONAL_CALENDAR[seasonKey] : getCurrentSeason();

    return season.ingredients.some(seasonal =>
        lowerName.includes(seasonal) || seasonal.includes(lowerName)
    );
}

// Calculate seasonal score for a recipe (percentage of seasonal ingredients)
function calculateSeasonalScore(ingredients, seasonKey = null) {
    if (!ingredients || ingredients.length === 0) return 0;

    const seasonalCount = ingredients.filter(ing =>
        isIngredientInSeason(ing.name, seasonKey)
    ).length;

    return Math.round((seasonalCount / ingredients.length) * 100);
}

// Get seasonal information for ingredients
function getSeasonalInfo(ingredients) {
    const currentSeason = getCurrentSeason();

    return ingredients.map(ing => ({
        ...ing,
        isInSeason: isIngredientInSeason(ing.name),
        seasonalNote: isIngredientInSeason(ing.name)
            ? `In Saison (${currentSeason.name})`
            : null
    }));
}

module.exports = {
    SEASONAL_CALENDAR,
    getCurrentSeason,
    isIngredientInSeason,
    calculateSeasonalScore,
    getSeasonalInfo
};
