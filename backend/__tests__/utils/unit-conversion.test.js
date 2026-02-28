const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    getUnitInfo,
    convertUnit,
    normalizeToBase,
    normalizeIngredientName,
    parseAmount,
    areUnitsCompatible,
} = require('../../utils/unit-conversion');

describe('getUnitInfo', () => {
    it('should identify weight units', () => {
        assert.deepStrictEqual(getUnitInfo('g'), { group: 'weight', factor: 1 });
        assert.deepStrictEqual(getUnitInfo('kg'), { group: 'weight', factor: 1000 });
        assert.deepStrictEqual(getUnitInfo('Gramm'), { group: 'weight', factor: 1 });
    });

    it('should identify volume units', () => {
        assert.deepStrictEqual(getUnitInfo('ml'), { group: 'volume', factor: 1 });
        assert.deepStrictEqual(getUnitInfo('l'), { group: 'volume', factor: 1000 });
        assert.deepStrictEqual(getUnitInfo('EL'), { group: 'volume', factor: 15 });
        assert.deepStrictEqual(getUnitInfo('TL'), { group: 'volume', factor: 5 });
        assert.deepStrictEqual(getUnitInfo('cl'), { group: 'volume', factor: 10 });
    });

    it('should identify count units', () => {
        const info = getUnitInfo('Stück');
        assert.equal(info.group, 'count');
        assert.equal(info.factor, 1);
    });

    it('should return null for unknown units', () => {
        assert.equal(getUnitInfo('xyz'), null);
        assert.equal(getUnitInfo(''), null);
        assert.equal(getUnitInfo(null), null);
    });

    it('should handle trailing dots', () => {
        const info = getUnitInfo('Stk.');
        assert.equal(info.group, 'count');
    });
});

describe('convertUnit', () => {
    it('should convert g to kg', () => {
        assert.equal(convertUnit(1000, 'g', 'kg'), 1);
    });

    it('should convert kg to g', () => {
        assert.equal(convertUnit(1.5, 'kg', 'g'), 1500);
    });

    it('should convert ml to l', () => {
        assert.equal(convertUnit(500, 'ml', 'l'), 0.5);
    });

    it('should convert l to ml', () => {
        assert.equal(convertUnit(2, 'l', 'ml'), 2000);
    });

    it('should convert cl to ml', () => {
        assert.equal(convertUnit(25, 'cl', 'ml'), 250);
    });

    it('should convert EL to ml', () => {
        assert.equal(convertUnit(3, 'EL', 'ml'), 45);
    });

    it('should return null for incompatible units', () => {
        assert.equal(convertUnit(100, 'g', 'ml'), null);
        assert.equal(convertUnit(1, 'kg', 'l'), null);
    });

    it('should return null for invalid amount', () => {
        assert.equal(convertUnit(NaN, 'g', 'kg'), null);
        assert.equal(convertUnit('abc', 'g', 'kg'), null);
    });

    it('should return null for unknown units', () => {
        assert.equal(convertUnit(100, 'xyz', 'g'), null);
    });
});

describe('normalizeToBase', () => {
    it('should normalize kg to g', () => {
        assert.deepStrictEqual(normalizeToBase(2, 'kg'), { amount: 2000, unit: 'g' });
    });

    it('should normalize l to ml', () => {
        assert.deepStrictEqual(normalizeToBase(0.5, 'l'), { amount: 500, unit: 'ml' });
    });

    it('should keep g as g', () => {
        assert.deepStrictEqual(normalizeToBase(250, 'g'), { amount: 250, unit: 'g' });
    });

    it('should keep ml as ml', () => {
        assert.deepStrictEqual(normalizeToBase(100, 'ml'), { amount: 100, unit: 'ml' });
    });

    it('should normalize EL to ml', () => {
        assert.deepStrictEqual(normalizeToBase(2, 'EL'), { amount: 30, unit: 'ml' });
    });

    it('should return null for unknown unit', () => {
        assert.equal(normalizeToBase(100, 'xyz'), null);
    });
});

describe('normalizeIngredientName', () => {
    it('should lowercase and trim', () => {
        assert.equal(normalizeIngredientName('  Tomate  '), 'tomat');
    });

    it('should strip plural suffix -n (Karotten → karott)', () => {
        const a = normalizeIngredientName('Karotten');
        const b = normalizeIngredientName('Karotte');
        assert.equal(a, b);
    });

    it('should strip plural suffix -en (Tomaten → tomat)', () => {
        const a = normalizeIngredientName('Tomaten');
        const b = normalizeIngredientName('Tomate');
        assert.equal(a, b);
    });

    it('should match Zwiebel and Zwiebeln', () => {
        const a = normalizeIngredientName('Zwiebeln');
        const b = normalizeIngredientName('Zwiebel');
        assert.equal(a, b);
    });

    it('should match Kartoffel and Kartoffeln', () => {
        const a = normalizeIngredientName('Kartoffeln');
        const b = normalizeIngredientName('Kartoffel');
        assert.equal(a, b);
    });

    it('should remove parenthetical info', () => {
        assert.equal(
            normalizeIngredientName('Butter (weich)'),
            normalizeIngredientName('Butter')
        );
    });

    it('should not strip from short words', () => {
        assert.equal(normalizeIngredientName('Ei'), 'ei');
        assert.equal(normalizeIngredientName('Öl'), 'öl');
    });

    it('should handle empty/null input', () => {
        assert.equal(normalizeIngredientName(''), '');
        assert.equal(normalizeIngredientName(null), '');
    });

    it('should collapse whitespace', () => {
        assert.equal(
            normalizeIngredientName('rote   Zwiebel'),
            normalizeIngredientName('rote Zwiebel')
        );
    });
});

describe('parseAmount', () => {
    it('should parse integer strings', () => {
        assert.equal(parseAmount('3'), 3);
    });

    it('should parse decimal strings with dot', () => {
        assert.equal(parseAmount('1.5'), 1.5);
    });

    it('should parse decimal strings with comma', () => {
        assert.equal(parseAmount('1,5'), 1.5);
    });

    it('should parse fractions', () => {
        assert.equal(parseAmount('1/2'), 0.5);
        assert.equal(parseAmount('3/4'), 0.75);
    });

    it('should parse mixed numbers', () => {
        assert.equal(parseAmount('1 1/2'), 1.5);
        assert.equal(parseAmount('2 1/4'), 2.25);
    });

    it('should pass through numbers', () => {
        assert.equal(parseAmount(42), 42);
    });

    it('should return null for non-parseable', () => {
        assert.equal(parseAmount('abc'), null);
        assert.equal(parseAmount(''), null);
        assert.equal(parseAmount(null), null);
    });

    it('should return null for division by zero', () => {
        assert.equal(parseAmount('1/0'), null);
    });
});

describe('areUnitsCompatible', () => {
    it('should return true for same group', () => {
        assert.equal(areUnitsCompatible('g', 'kg'), true);
        assert.equal(areUnitsCompatible('ml', 'l'), true);
        assert.equal(areUnitsCompatible('Stück', 'Stk'), true);
    });

    it('should return false for different groups', () => {
        assert.equal(areUnitsCompatible('g', 'ml'), false);
        assert.equal(areUnitsCompatible('kg', 'l'), false);
        assert.equal(areUnitsCompatible('Stück', 'g'), false);
    });

    it('should return false for unknown units', () => {
        assert.equal(areUnitsCompatible('xyz', 'g'), false);
    });
});
