#!/usr/bin/env node

/**
 * SQLite to PostgreSQL Data Migration Script
 *
 * This script migrates existing data from SQLite to PostgreSQL.
 * Run this after setting up the PostgreSQL database with the schema.
 *
 * Usage:
 *   node scripts/migrate-data.js
 *
 * Environment variables:
 *   SQLITE_PATH - Path to SQLite database (default: ./data/foodplanner.db)
 *   DATABASE_URL - PostgreSQL connection string
 */

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

// Configuration
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'foodplanner.db');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is required');
    console.error('Example: DATABASE_URL=postgresql://user:password@localhost:5432/foodplanner');
    process.exit(1);
}

// Helper to promisify SQLite queries
function sqliteAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

async function migrate() {
    console.log('='.repeat(60));
    console.log('SQLite to PostgreSQL Migration');
    console.log('='.repeat(60));
    console.log(`SQLite path: ${SQLITE_PATH}`);
    console.log(`PostgreSQL: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
    console.log('='.repeat(60));

    // Connect to SQLite
    const sqliteDb = new sqlite3.Database(SQLITE_PATH, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('Failed to open SQLite database:', err.message);
            process.exit(1);
        }
    });

    // Connect to PostgreSQL
    const pgPool = new Pool({ connectionString: DATABASE_URL });

    try {
        // Test PostgreSQL connection
        await pgPool.query('SELECT NOW()');
        console.log('Connected to PostgreSQL');

        // Start migration
        const client = await pgPool.connect();

        try {
            await client.query('BEGIN');

            // 1. Migrate recipes
            console.log('\n[1/8] Migrating recipes...');
            const recipes = await sqliteAll(sqliteDb, 'SELECT * FROM recipes');
            for (const recipe of recipes) {
                await client.query(
                    `INSERT INTO recipes (id, name, category, servings, instructions, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     ON CONFLICT (id) DO NOTHING`,
                    [
                        recipe.id,
                        recipe.name,
                        recipe.category,
                        recipe.servings,
                        recipe.instructions,
                        recipe.created_at || new Date().toISOString(),
                        recipe.updated_at || new Date().toISOString()
                    ]
                );
            }
            console.log(`   Migrated ${recipes.length} recipes`);

            // 2. Migrate ingredients
            console.log('[2/8] Migrating ingredients...');
            const ingredients = await sqliteAll(sqliteDb, 'SELECT * FROM ingredients');
            for (const ing of ingredients) {
                await client.query(
                    `INSERT INTO ingredients (recipe_id, name, amount, unit, category)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [ing.recipe_id, ing.name, ing.amount, ing.unit, ing.category || 'Sonstiges']
                );
            }
            console.log(`   Migrated ${ingredients.length} ingredients`);

            // 3. Migrate recipe_tags
            console.log('[3/8] Migrating recipe tags...');
            const recipeTags = await sqliteAll(sqliteDb, 'SELECT * FROM recipe_tags');
            for (const tag of recipeTags) {
                await client.query(
                    `INSERT INTO recipe_tags (recipe_id, tag)
                     VALUES ($1, $2)`,
                    [tag.recipe_id, tag.tag]
                );
            }
            console.log(`   Migrated ${recipeTags.length} recipe tags`);

            // 4. Migrate week_plans
            console.log('[4/8] Migrating week plans...');
            const weekPlans = await sqliteAll(sqliteDb, 'SELECT * FROM week_plans');
            for (const plan of weekPlans) {
                await client.query(
                    `INSERT INTO week_plans (id, start_date, created_at, updated_at)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (id) DO NOTHING`,
                    [
                        plan.id,
                        plan.start_date,
                        plan.created_at || new Date().toISOString(),
                        plan.updated_at || new Date().toISOString()
                    ]
                );
            }
            console.log(`   Migrated ${weekPlans.length} week plans`);

            // 5. Migrate days (need to track old ID -> new ID mapping)
            console.log('[5/8] Migrating days...');
            const days = await sqliteAll(sqliteDb, 'SELECT * FROM days');
            const dayIdMap = new Map(); // old SQLite ID -> new PostgreSQL ID

            for (const day of days) {
                const result = await client.query(
                    `INSERT INTO days (week_plan_id, date, day_name)
                     VALUES ($1, $2, $3)
                     RETURNING id`,
                    [day.week_plan_id, day.date, day.day_name]
                );
                dayIdMap.set(day.id, result.rows[0].id);
            }
            console.log(`   Migrated ${days.length} days`);

            // 6. Migrate meals (using the day ID mapping)
            console.log('[6/8] Migrating meals...');
            const meals = await sqliteAll(sqliteDb, 'SELECT * FROM meals');
            for (const meal of meals) {
                const newDayId = dayIdMap.get(meal.day_id);
                if (newDayId) {
                    await client.query(
                        `INSERT INTO meals (id, day_id, recipe_id, recipe_name, meal_type)
                         VALUES ($1, $2, $3, $4, $5)
                         ON CONFLICT (id) DO NOTHING`,
                        [meal.id, newDayId, meal.recipe_id, meal.recipe_name, meal.meal_type]
                    );
                }
            }
            console.log(`   Migrated ${meals.length} meals`);

            // 7. Migrate week_plan_templates
            console.log('[7/8] Migrating week plan templates...');
            const templates = await sqliteAll(sqliteDb, 'SELECT * FROM week_plan_templates');
            for (const template of templates) {
                // Parse template_data if it's a string (SQLite stores as TEXT)
                let templateData = template.template_data;
                if (typeof templateData === 'string') {
                    try {
                        templateData = JSON.parse(templateData);
                    } catch (e) {
                        console.warn(`   Warning: Could not parse template_data for template ${template.id}`);
                        templateData = {};
                    }
                }

                await client.query(
                    `INSERT INTO week_plan_templates (id, name, description, template_data, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (id) DO NOTHING`,
                    [
                        template.id,
                        template.name,
                        template.description,
                        JSON.stringify(templateData),
                        template.created_at || new Date().toISOString(),
                        template.updated_at || new Date().toISOString()
                    ]
                );
            }
            console.log(`   Migrated ${templates.length} templates`);

            // 8. Migrate manual_shopping_items
            console.log('[8/8] Migrating manual shopping items...');
            const shoppingItems = await sqliteAll(sqliteDb, 'SELECT * FROM manual_shopping_items');
            for (const item of shoppingItems) {
                await client.query(
                    `INSERT INTO manual_shopping_items (id, name, amount, unit, category, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (id) DO NOTHING`,
                    [
                        item.id,
                        item.name,
                        item.amount,
                        item.unit,
                        item.category || 'Sonstiges',
                        item.created_at || new Date().toISOString()
                    ]
                );
            }
            console.log(`   Migrated ${shoppingItems.length} manual shopping items`);

            // Commit transaction
            await client.query('COMMIT');

            console.log('\n' + '='.repeat(60));
            console.log('Migration completed successfully!');
            console.log('='.repeat(60));

            // Print summary
            console.log('\nSummary:');
            console.log(`  - Recipes: ${recipes.length}`);
            console.log(`  - Ingredients: ${ingredients.length}`);
            console.log(`  - Recipe Tags: ${recipeTags.length}`);
            console.log(`  - Week Plans: ${weekPlans.length}`);
            console.log(`  - Days: ${days.length}`);
            console.log(`  - Meals: ${meals.length}`);
            console.log(`  - Templates: ${templates.length}`);
            console.log(`  - Shopping Items: ${shoppingItems.length}`);

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('\nMigration failed:', error.message);
        process.exit(1);
    } finally {
        // Close connections
        sqliteDb.close();
        await pgPool.end();
    }
}

// Run migration
migrate().catch(console.error);
