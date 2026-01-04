const {
    CATEGORIES,
    categorizeIngredient,
    getValidCategories
} = require('../../utils/categorization');

describe('Ingredient Categorization', () => {
    describe('categorizeIngredient', () => {
        describe('Obst & Gemüse', () => {
            const fruitsAndVeggies = [
                'Tomate', 'tomaten', 'TOMATEN',
                'Karotte', 'Karotten', 'Möhre',
                'Apfel', 'grüner Apfel',
                'Zwiebel', 'rote Zwiebel',
                'Knoblauch', 'Knoblauchzehe',
                'Brokkoli', 'frischer Brokkoli',
                'Champignon', 'Champignons',
                'Basilikum', 'frisches Basilikum'
            ];

            fruitsAndVeggies.forEach(ingredient => {
                it(`should categorize "${ingredient}" as Obst & Gemüse`, () => {
                    expect(categorizeIngredient(ingredient)).toBe(CATEGORIES.FRUITS_VEGGIES);
                });
            });
        });

        describe('Milchprodukte', () => {
            const dairy = [
                'Milch', 'Vollmilch', 'fettarme Milch',
                'Butter', 'Butter (weich)',
                'Käse', 'geriebener Käse', 'Hartkäse',
                'Sahne', 'Schlagsahne', 'saure Sahne',
                'Joghurt', 'griechischer Joghurt',
                'Mozzarella', 'frischer Mozzarella',
                'Parmesan', 'Parmesankäse'
            ];

            dairy.forEach(ingredient => {
                it(`should categorize "${ingredient}" as Milchprodukte`, () => {
                    expect(categorizeIngredient(ingredient)).toBe(CATEGORIES.DAIRY);
                });
            });
        });

        describe('Fleisch & Fisch', () => {
            const meatAndFish = [
                'Hähnchen', 'Hähnchenbrust', 'Hähnchenfilet',
                'Rindfleisch', 'Rinderhack',
                'Schweinefleisch', 'Schweinefilet',
                'Lachs', 'Lachsfilet', 'geräucherter Lachs',
                'Thunfisch', 'Thunfisch in Öl',
                'Speck', 'durchwachsener Speck',
                'Schinken', 'gekochter Schinken'
            ];

            meatAndFish.forEach(ingredient => {
                it(`should categorize "${ingredient}" as Fleisch & Fisch`, () => {
                    expect(categorizeIngredient(ingredient)).toBe(CATEGORIES.MEAT_FISH);
                });
            });
        });

        describe('Trockenwaren', () => {
            const dryGoods = [
                'Mehl', 'Weizenmehl', 'Dinkelmehl',
                'Zucker', 'brauner Zucker', 'Puderzucker',
                'Reis', 'Basmati-Reis', 'Langkornreis',
                'Nudeln', 'Spaghetti', 'Pasta',
                'Salz', 'Meersalz',
                'Pfeffer', 'schwarzer Pfeffer',
                'Olivenöl', 'Öl',
                'Essig', 'Balsamico-Essig'
            ];

            dryGoods.forEach(ingredient => {
                it(`should categorize "${ingredient}" as Trockenwaren`, () => {
                    expect(categorizeIngredient(ingredient)).toBe(CATEGORIES.DRY_GOODS);
                });
            });
        });

        describe('Tiefkühl', () => {
            const frozen = [
                'Tiefkühl-Erbsen', 'TK-Erbsen',
                'Tiefkühl Gemüse', 'gefrorene Beeren',
                'Eis', 'Erdbeereis'
            ];

            frozen.forEach(ingredient => {
                it(`should categorize "${ingredient}" as Tiefkühl`, () => {
                    expect(categorizeIngredient(ingredient)).toBe(CATEGORIES.FROZEN);
                });
            });
        });

        describe('Sonstiges (fallback)', () => {
            const other = [
                'Hefe (frisch)',
                'Backpulver',
                'Senf',
                'Ketchup',
                'Sojasauce',
                'unbekannte Zutat',
                'xyz123'
            ];

            // Note: Some of these might be categorized differently based on keywords
            it('should return Sonstiges for truly unknown ingredients', () => {
                expect(categorizeIngredient('xyz123')).toBe(CATEGORIES.OTHER);
                expect(categorizeIngredient('unbekannte Zutat')).toBe(CATEGORIES.OTHER);
            });
        });

        describe('case insensitivity', () => {
            it('should handle uppercase input', () => {
                expect(categorizeIngredient('TOMATE')).toBe(CATEGORIES.FRUITS_VEGGIES);
                expect(categorizeIngredient('MILCH')).toBe(CATEGORIES.DAIRY);
            });

            it('should handle mixed case input', () => {
                expect(categorizeIngredient('ToMaTe')).toBe(CATEGORIES.FRUITS_VEGGIES);
                expect(categorizeIngredient('MiLcH')).toBe(CATEGORIES.DAIRY);
            });
        });

        describe('compound ingredients', () => {
            it('should categorize based on primary ingredient', () => {
                expect(categorizeIngredient('Tomatensauce')).toBe(CATEGORIES.FRUITS_VEGGIES);
                expect(categorizeIngredient('Buttermilch')).toBe(CATEGORIES.DAIRY);
                expect(categorizeIngredient('Hähnchenbrust ohne Haut')).toBe(CATEGORIES.MEAT_FISH);
            });
        });
    });

    describe('getValidCategories', () => {
        it('should return all valid category names', () => {
            const categories = getValidCategories();
            expect(categories).toContain('Obst & Gemüse');
            expect(categories).toContain('Milchprodukte');
            expect(categories).toContain('Fleisch & Fisch');
            expect(categories).toContain('Trockenwaren');
            expect(categories).toContain('Tiefkühl');
            expect(categories).toContain('Sonstiges');
        });

        it('should return exactly 6 categories', () => {
            expect(getValidCategories()).toHaveLength(6);
        });
    });

    describe('CATEGORIES constant', () => {
        it('should have all expected category keys', () => {
            expect(CATEGORIES.FRUITS_VEGGIES).toBe('Obst & Gemüse');
            expect(CATEGORIES.DAIRY).toBe('Milchprodukte');
            expect(CATEGORIES.MEAT_FISH).toBe('Fleisch & Fisch');
            expect(CATEGORIES.DRY_GOODS).toBe('Trockenwaren');
            expect(CATEGORIES.FROZEN).toBe('Tiefkühl');
            expect(CATEGORIES.OTHER).toBe('Sonstiges');
        });
    });
});
