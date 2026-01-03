const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'FoodPlanner API',
            version: '1.0.0',
            description: 'REST API für den FoodPlanner - Essenswochenplaner',
            contact: {
                name: 'FoodPlanner',
                url: 'https://github.com/milkrunner/FoodPlanner'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Entwicklungsserver'
            }
        ],
        tags: [
            { name: 'Recipes', description: 'Rezept-Verwaltung' },
            { name: 'Week Plan', description: 'Wochenplan-Verwaltung' },
            { name: 'Templates', description: 'Wochenplan-Vorlagen' },
            { name: 'Shopping', description: 'Einkaufsliste und Budget' },
            { name: 'Cooking History', description: 'Kochverlauf' },
            { name: 'AI', description: 'KI-gestützte Features' },
            { name: 'System', description: 'System-Endpoints' }
        ],
        components: {
            schemas: {
                Recipe: {
                    type: 'object',
                    required: ['id', 'name'],
                    properties: {
                        id: {
                            type: 'string',
                            description: 'Eindeutige Rezept-ID',
                            example: '1704067200000'
                        },
                        name: {
                            type: 'string',
                            description: 'Rezeptname',
                            example: 'Spaghetti Carbonara'
                        },
                        category: {
                            type: 'string',
                            description: 'Rezeptkategorie',
                            example: 'Hauptgericht'
                        },
                        servings: {
                            type: 'integer',
                            description: 'Anzahl Portionen',
                            example: 4
                        },
                        instructions: {
                            type: 'string',
                            description: 'Zubereitungsanleitung',
                            example: '1. Spaghetti kochen...'
                        },
                        ingredients: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Ingredient' }
                        },
                        tags: {
                            type: 'array',
                            items: { type: 'string' },
                            example: ['italienisch', 'schnell']
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time'
                        },
                        updated_at: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                Ingredient: {
                    type: 'object',
                    required: ['name', 'amount', 'unit'],
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Zutatenname',
                            example: 'Spaghetti'
                        },
                        amount: {
                            type: 'string',
                            description: 'Menge',
                            example: '400'
                        },
                        unit: {
                            type: 'string',
                            description: 'Einheit',
                            example: 'g'
                        },
                        category: {
                            type: 'string',
                            description: 'Warengruppe',
                            enum: ['Obst & Gemüse', 'Milchprodukte', 'Fleisch & Fisch', 'Trockenwaren', 'Tiefkühl', 'Sonstiges'],
                            example: 'Trockenwaren'
                        }
                    }
                },
                WeekPlan: {
                    type: 'object',
                    required: ['id', 'startDate', 'days'],
                    properties: {
                        id: {
                            type: 'string',
                            example: 'week-2024-01-15'
                        },
                        startDate: {
                            type: 'string',
                            format: 'date',
                            example: '2024-01-15'
                        },
                        days: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Day' }
                        }
                    }
                },
                Day: {
                    type: 'object',
                    properties: {
                        date: {
                            type: 'string',
                            format: 'date',
                            example: '2024-01-15'
                        },
                        dayName: {
                            type: 'string',
                            example: 'Montag'
                        },
                        meals: {
                            type: 'object',
                            properties: {
                                breakfast: { $ref: '#/components/schemas/Meal' },
                                lunch: { $ref: '#/components/schemas/Meal' },
                                dinner: { $ref: '#/components/schemas/Meal' }
                            }
                        }
                    }
                },
                Meal: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        recipeId: { type: 'string' },
                        recipeName: { type: 'string' },
                        mealType: {
                            type: 'string',
                            enum: ['breakfast', 'lunch', 'dinner']
                        }
                    }
                },
                Template: {
                    type: 'object',
                    required: ['id', 'name', 'templateData'],
                    properties: {
                        id: { type: 'string' },
                        name: {
                            type: 'string',
                            example: 'Arbeitswoche Standard'
                        },
                        description: { type: 'string' },
                        templateData: {
                            type: 'object',
                            description: 'JSONB Vorlage mit Tagen und Mahlzeiten'
                        },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                ManualShoppingItem: {
                    type: 'object',
                    required: ['id', 'name', 'amount', 'unit'],
                    properties: {
                        id: { type: 'string' },
                        name: {
                            type: 'string',
                            example: 'Brot'
                        },
                        amount: {
                            type: 'string',
                            example: '1'
                        },
                        unit: {
                            type: 'string',
                            example: 'Stück'
                        },
                        category: {
                            type: 'string',
                            example: 'Sonstiges'
                        },
                        created_at: { type: 'string', format: 'date-time' }
                    }
                },
                ShoppingBudget: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        week_start: {
                            type: 'string',
                            format: 'date',
                            example: '2024-01-15'
                        },
                        budget_amount: {
                            type: 'number',
                            format: 'float',
                            example: 150.00
                        },
                        currency: {
                            type: 'string',
                            example: 'EUR'
                        }
                    }
                },
                SubstitutionPreference: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        original_ingredient: {
                            type: 'string',
                            example: 'Parmesan'
                        },
                        substitute_ingredient: {
                            type: 'string',
                            example: 'Grana Padano'
                        },
                        reason: { type: 'string' },
                        savings_percent: { type: 'integer' },
                        is_active: { type: 'boolean' }
                    }
                },
                CookingHistoryEntry: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        recipe_id: { type: 'string' },
                        recipe_name: { type: 'string' },
                        recipe_category: { type: 'string' },
                        cooked_at: { type: 'string', format: 'date-time' },
                        servings: { type: 'integer' },
                        notes: { type: 'string' }
                    }
                },
                ShoppingOptimization: {
                    type: 'object',
                    properties: {
                        originalEstimate: { type: 'number', example: 45.50 },
                        optimizedEstimate: { type: 'number', example: 38.20 },
                        savingsPercent: { type: 'integer', example: 16 },
                        substitutions: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    original: { type: 'string' },
                                    substitute: { type: 'string' },
                                    reason: { type: 'string' },
                                    savingsPercent: { type: 'integer' },
                                    category: { type: 'string' }
                                }
                            }
                        },
                        seasonalTips: { type: 'array', items: { type: 'object' } },
                        quantityTips: { type: 'array', items: { type: 'object' } },
                        generalTips: { type: 'array', items: { type: 'string' } }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            description: 'Fehlerbeschreibung'
                        },
                        details: {
                            type: 'string',
                            description: 'Zusätzliche Details'
                        }
                    }
                },
                HealthCheck: {
                    type: 'object',
                    properties: {
                        status: {
                            type: 'string',
                            enum: ['OK', 'ERROR']
                        },
                        database: {
                            type: 'string',
                            enum: ['connected', 'disconnected']
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                }
            }
        }
    },
    apis: ['./swagger-paths.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
