/**
 * Unit conversion and ingredient name normalization utilities.
 * Used for matching shopping list items against pantry inventory.
 */

// Weight units → base unit grams
const WEIGHT_UNITS = {
    g: 1,
    gramm: 1,
    kg: 1000,
    kilogramm: 1000,
    mg: 0.001,
    pfund: 500,
};

// Volume units → base unit milliliters
const VOLUME_UNITS = {
    ml: 1,
    milliliter: 1,
    l: 1000,
    liter: 1000,
    cl: 10,
    zentiliter: 10,
    dl: 100,
    deziliter: 100,
    el: 15,   // Esslöffel ≈ 15ml
    tl: 5,    // Teelöffel ≈ 5ml
};

// Count/piece units — not convertible, matched directly
const COUNT_UNITS = new Set([
    'stück', 'stk', 'stk.', 'scheibe', 'scheiben',
    'packung', 'pkg', 'pck', 'dose', 'dosen',
    'flasche', 'flaschen', 'bund', 'beutel',
    'zehe', 'zehen', 'prise', 'prisen',
    'becher', 'glas', 'gläser', 'tasse', 'tassen',
]);

/**
 * Get the unit group (weight, volume, count) and conversion factor to base unit.
 * @param {string} unit
 * @returns {{ group: string, factor: number } | null}
 */
function getUnitInfo(unit) {
    if (!unit || typeof unit !== 'string') return null;
    const normalized = unit.trim().toLowerCase().replace(/\.$/, '');

    if (WEIGHT_UNITS[normalized] !== undefined) {
        return { group: 'weight', factor: WEIGHT_UNITS[normalized] };
    }
    if (VOLUME_UNITS[normalized] !== undefined) {
        return { group: 'volume', factor: VOLUME_UNITS[normalized] };
    }
    if (COUNT_UNITS.has(normalized)) {
        return { group: 'count', factor: 1 };
    }
    return null;
}

/**
 * Convert an amount from one unit to another (within the same group).
 * Returns null if units are incompatible.
 * @param {number} amount
 * @param {string} fromUnit
 * @param {string} toUnit
 * @returns {number | null}
 */
function convertUnit(amount, fromUnit, toUnit) {
    if (typeof amount !== 'number' || isNaN(amount)) return null;

    const from = getUnitInfo(fromUnit);
    const to = getUnitInfo(toUnit);

    if (!from || !to) return null;
    if (from.group !== to.group) return null;

    // Convert: source → base → target
    const baseAmount = amount * from.factor;
    return baseAmount / to.factor;
}

/**
 * Normalize an amount+unit to the base unit of its group (g for weight, ml for volume).
 * Returns { amount, unit } or null if unknown unit.
 * @param {number} amount
 * @param {string} unit
 * @returns {{ amount: number, unit: string } | null}
 */
function normalizeToBase(amount, unit) {
    if (typeof amount !== 'number' || isNaN(amount)) return null;

    const info = getUnitInfo(unit);
    if (!info) return null;

    if (info.group === 'weight') {
        return { amount: amount * info.factor, unit: 'g' };
    }
    if (info.group === 'volume') {
        return { amount: amount * info.factor, unit: 'ml' };
    }
    // Count units: keep as-is
    return { amount, unit: unit.trim().toLowerCase() };
}

/**
 * German plural suffixes to strip for ingredient name normalization.
 * Order matters — longer suffixes first to avoid partial matches.
 */
const PLURAL_SUFFIXES = ['en', 'n', 'e', 's'];

/**
 * Normalize an ingredient name for fuzzy matching.
 * Lowercase, trim, strip common German plural suffixes.
 * @param {string} name
 * @returns {string}
 */
function normalizeIngredientName(name) {
    if (!name || typeof name !== 'string') return '';
    let normalized = name.trim().toLowerCase();

    // Remove parenthetical info like "(frisch)" or "(500g)"
    normalized = normalized.replace(/\s*\(.*?\)\s*/g, ' ').trim();

    // Collapse whitespace
    normalized = normalized.replace(/\s+/g, ' ');

    // Don't strip suffixes from very short words (< 4 chars)
    if (normalized.length < 4) return normalized;

    // Try stripping plural suffixes
    for (const suffix of PLURAL_SUFFIXES) {
        if (normalized.endsWith(suffix) && normalized.length - suffix.length >= 3) {
            return normalized.slice(0, -suffix.length);
        }
    }

    return normalized;
}

/**
 * Parse a numeric amount from a string that may contain fractions or ranges.
 * @param {string|number} value
 * @returns {number|null}
 */
function parseAmount(value) {
    if (typeof value === 'number') return isNaN(value) ? null : value;
    if (!value || typeof value !== 'string') return null;

    const trimmed = value.trim();

    // Direct numeric
    const num = Number(trimmed.replace(',', '.'));
    if (!isNaN(num)) return num;

    // Fraction like "1/2"
    const fractionMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (fractionMatch) {
        const denom = Number(fractionMatch[2]);
        if (denom === 0) return null;
        return Number(fractionMatch[1]) / denom;
    }

    // Mixed number like "1 1/2"
    const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
    if (mixedMatch) {
        const denom = Number(mixedMatch[3]);
        if (denom === 0) return null;
        return Number(mixedMatch[1]) + Number(mixedMatch[2]) / denom;
    }

    return null;
}

/**
 * Check if two unit strings are in the same unit group (both weight, both volume, etc.).
 * @param {string} unitA
 * @param {string} unitB
 * @returns {boolean}
 */
function areUnitsCompatible(unitA, unitB) {
    const infoA = getUnitInfo(unitA);
    const infoB = getUnitInfo(unitB);
    if (!infoA || !infoB) return false;
    return infoA.group === infoB.group;
}

module.exports = {
    getUnitInfo,
    convertUnit,
    normalizeToBase,
    normalizeIngredientName,
    parseAmount,
    areUnitsCompatible,
};
