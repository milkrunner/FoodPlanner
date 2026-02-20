const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'FoodPlanner API',
            version: '1.0.0',
            description: `REST API für den FoodPlanner - Essenswochenplaner

## CORS-Konfiguration

Die API verwendet eine Whitelist für Cross-Origin Requests:
- **Standard**: localhost-Varianten (Port 80, 3000, 8080) sind automatisch erlaubt
- **Produktion**: Zusätzliche Origins über \`CORS_ORIGINS\` Umgebungsvariable konfigurierbar
- **Credentials**: Cookies und Authorization-Header werden unterstützt
- **Preflight-Cache**: 24 Stunden (86400 Sekunden)

Beispiel für CORS_ORIGINS:
\`\`\`
CORS_ORIGINS=https://foodplanner.example.com,https://app.example.com
\`\`\``,
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
            { name: 'Pantry', description: 'Vorratsverwaltung / Ingredient Inventory' },
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
                        is_favorite: {
                            type: 'boolean',
                            description: 'Gibt an, ob das Rezept als Favorit markiert ist',
                            example: true
                        },
                        prep_time: {
                            type: 'integer',
                            description: 'Vorbereitungszeit in Minuten',
                            example: 15
                        },
                        cook_time: {
                            type: 'integer',
                            description: 'Kochzeit in Minuten',
                            example: 30
                        },
                        difficulty: {
                            type: 'string',
                            description: 'Schwierigkeitsgrad',
                            example: 'Einfach'
                        },
                        is_meal_prep_suitable: {
                            type: 'boolean',
                            description: 'Kennzeichnet, ob sich das Rezept gut für Meal-Prep eignet',
                            example: true
                        },
                        meal_prep_fridge_days: {
                            type: 'integer',
                            nullable: true,
                            description: 'Maximale Anzahl an Tagen, die das Gericht im Kühlschrank haltbar bleibt',
                            example: 3
                        },
                        meal_prep_freezer_days: {
                            type: 'integer',
                            nullable: true,
                            description: 'Maximale Anzahl an Tagen, die das Gericht eingefroren werden kann',
                            example: 30
                        },
                        meal_prep_reheat_tips: {
                            type: 'string',
                            nullable: true,
                            description: 'Hinweise zum Aufwärmen der vorbereiteten Portionen',
                            example: 'Im Topf mit etwas Brühe schonend erwärmen.'
                        },
                        meal_prep_batch_notes: {
                            type: 'string',
                            nullable: true,
                            description: 'Besondere Hinweise zum Batch-Cooking, z.B. Arbeitsschritte oder Portionierung',
                            example: 'Gemüse getrennt garen, damit es beim Aufwärmen bissfest bleibt.'
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
                        mealPrepPlan: {
                            $ref: '#/components/schemas/MealPrepPlan'
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
                MealPrepPlan: {
                    type: 'object',
                    description: 'Meal-Prep Einstellungen und Batch-Cooking Planung pro Woche',
                    properties: {
                        prepDate: {
                            type: 'string',
                            format: 'date',
                            nullable: true,
                            description: 'Geplanter Meal-Prep Tag für die Woche'
                        },
                        items: {
                            type: 'object',
                            description: 'Map von Rezept-ID auf Meal-Prep Konfiguration',
                            additionalProperties: {
                                $ref: '#/components/schemas/MealPrepItem'
                            }
                        }
                    },
                    example: {
                        prepDate: '2024-01-14',
                        items: {
                            'recipe-123': {
                                recipeId: 'recipe-123',
                                recipeName: 'Gemüse-Lasagne',
                                totalPortions: 6,
                                targetDates: ['2024-01-15', '2024-01-17'],
                                mealTypes: ['Mittagessen'],
                                notes: '2 Portionen direkt einfrieren'
                            }
                        }
                    }
                },
                MealPrepItem: {
                    type: 'object',
                    description: 'Meal-Prep Konfiguration für ein Rezept',
                    properties: {
                        recipeId: {
                            type: 'string',
                            description: 'Rezept-ID (optional, falls als Schlüssel bereits vorhanden)'
                        },
                        recipeName: {
                            type: 'string',
                            description: 'Name des Rezepts'
                        },
                        totalPortions: {
                            type: 'integer',
                            nullable: true,
                            description: 'Anzahl der vorgekochten Portionen'
                        },
                        targetDates: {
                            type: 'array',
                            items: {
                                type: 'string',
                                format: 'date'
                            },
                            description: 'Geplante Verbrauchstage'
                        },
                        mealTypes: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Zuordnung zu Mahlzeiten (z.B. Mittagessen)'
                        },
                        notes: {
                            type: 'string',
                            nullable: true,
                            description: 'Zusätzliche Hinweise zum Batch-Cooking'
                        }
                    }
                },
                AIGeneratedMeal: {
                    type: 'object',
                    description: 'Von der KI generierter Mahlzeitenvorschlag',
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Name des Gerichts',
                            example: 'Gemüse-Curry mit Basmatireis'
                        },
                        description: {
                            type: 'string',
                            description: 'Kurze Beschreibung des Gerichts',
                            example: 'Cremiges Thai-Curry mit saisonalem Gemüse'
                        },
                        category: {
                            type: 'string',
                            description: 'Kategorie des Gerichts',
                            example: 'Hauptgericht'
                        }
                    }
                },
                PantryItem: {
                    type: 'object',
                    required: ['id', 'name'],
                    properties: {
                        id: {
                            type: 'integer',
                            description: 'Eindeutige Pantry-Item-ID',
                            example: 1
                        },
                        name: {
                            type: 'string',
                            description: 'Name des Vorratsartikels',
                            example: 'Mehl'
                        },
                        quantity: {
                            type: 'number',
                            nullable: true,
                            description: 'Menge',
                            example: 500
                        },
                        unit: {
                            type: 'string',
                            nullable: true,
                            description: 'Einheit',
                            example: 'g'
                        },
                        category: {
                            type: 'string',
                            nullable: true,
                            description: 'Kategorie des Artikels',
                            example: 'Trockenwaren'
                        },
                        location: {
                            type: 'string',
                            nullable: true,
                            description: 'Lagerort',
                            example: 'Vorratsschrank'
                        },
                        purchase_date: {
                            type: 'string',
                            format: 'date',
                            nullable: true,
                            description: 'Kaufdatum'
                        },
                        expiry_date: {
                            type: 'string',
                            format: 'date',
                            nullable: true,
                            description: 'Ablaufdatum'
                        },
                        notes: {
                            type: 'string',
                            nullable: true,
                            description: 'Notizen'
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
