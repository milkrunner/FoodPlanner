const { z } = require('zod');

const ingredientSchema = z.object({
    amount: z.string().max(50).optional(),
    unit: z.string().max(50).optional(),
    name: z.string().min(1).max(200),
});

const createRecipeSchema = z.object({
    name: z.string().min(1).max(500),
    ingredients: z.array(ingredientSchema).max(200).optional(),
    instructions: z.string().max(50000).optional(),
    tags: z.array(z.string().max(100)).max(50).optional(),
    prep_time: z.number().int().min(0).max(10000).optional().nullable(),
    cook_time: z.number().int().min(0).max(10000).optional().nullable(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional().nullable(),
    servings: z.number().int().min(1).max(1000).optional().nullable(),
    source_url: z.string().url().max(2000).optional().nullable(),
});

module.exports = { createRecipeSchema };
