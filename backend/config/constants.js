// Central constants — single source of truth for values used across the backend

const AI_MODEL = 'gemini-2.5-flash';

const INGREDIENT_CATEGORIES = [
    'Obst & Gemüse',
    'Milchprodukte',
    'Fleisch & Fisch',
    'Trockenwaren',
    'Tiefkühl',
    'Sonstiges'
];

const VALID_VARIANT_TYPES = [
    'vegetarisch', 'vegan', 'low-carb', 'glutenfrei',
    'laktosefrei', 'schnell', 'kalorienarm'
];

const VARIANT_DESCRIPTIONS = {
    'vegetarisch': 'eine vegetarische Version (ohne Fleisch und Fisch, aber mit Milchprodukten und Eiern)',
    'vegan': 'eine vegane Version (komplett ohne tierische Produkte)',
    'low-carb': 'eine Low-Carb Version (wenig Kohlenhydrate, max 20g pro Portion)',
    'glutenfrei': 'eine glutenfreie Version (ohne Weizen, Roggen, Gerste, Dinkel)',
    'laktosefrei': 'eine laktosefreie Version (ohne Milchprodukte oder mit laktosefreien Alternativen)',
    'schnell': 'eine schnelle Version (Zubereitungszeit unter 30 Minuten)',
    'kalorienarm': 'eine kalorienarme Version (reduzierte Kalorien durch leichtere Zutaten)'
};

module.exports = { AI_MODEL, INGREDIENT_CATEGORIES, VALID_VARIANT_TYPES, VARIANT_DESCRIPTIONS };
