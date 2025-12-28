-- FoodPlanner PostgreSQL Schema
-- Initial migration from SQLite
-- Uses TEXT for IDs to maintain compatibility with frontend

-- Tabelle: recipes
CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    servings INTEGER,
    instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle: ingredients
CREATE TABLE IF NOT EXISTS ingredients (
    id SERIAL PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    amount VARCHAR(50) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    category VARCHAR(100) DEFAULT 'Sonstiges'
);

-- Tabelle: recipe_tags
CREATE TABLE IF NOT EXISTS recipe_tags (
    id SERIAL PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL
);

-- Tabelle: week_plans
CREATE TABLE IF NOT EXISTS week_plans (
    id TEXT PRIMARY KEY,
    start_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle: days
CREATE TABLE IF NOT EXISTS days (
    id SERIAL PRIMARY KEY,
    week_plan_id TEXT NOT NULL REFERENCES week_plans(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    day_name VARCHAR(20) NOT NULL
);

-- Tabelle: meals
CREATE TABLE IF NOT EXISTS meals (
    id TEXT PRIMARY KEY,
    day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
    recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
    recipe_name VARCHAR(255) NOT NULL,
    meal_type VARCHAR(50) NOT NULL
);

-- Tabelle: week_plan_templates
CREATE TABLE IF NOT EXISTS week_plan_templates (
    id TEXT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle: manual_shopping_items
CREATE TABLE IF NOT EXISTS manual_shopping_items (
    id TEXT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    amount VARCHAR(50) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    category VARCHAR(100) DEFAULT 'Sonstiges',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indizes fuer bessere Performance
CREATE INDEX IF NOT EXISTS idx_ingredients_recipe_id ON ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_id ON recipe_tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_tag ON recipe_tags(tag);
CREATE INDEX IF NOT EXISTS idx_days_week_plan_id ON days(week_plan_id);
CREATE INDEX IF NOT EXISTS idx_meals_day_id ON meals(day_id);
CREATE INDEX IF NOT EXISTS idx_meals_recipe_id ON meals(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_name ON recipes(name);
CREATE INDEX IF NOT EXISTS idx_week_plans_start_date ON week_plans(start_date);

-- Trigger fuer automatische updated_at Aktualisierung
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_recipes_updated_at ON recipes;
CREATE TRIGGER update_recipes_updated_at
    BEFORE UPDATE ON recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_week_plans_updated_at ON week_plans;
CREATE TRIGGER update_week_plans_updated_at
    BEFORE UPDATE ON week_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_week_plan_templates_updated_at ON week_plan_templates;
CREATE TRIGGER update_week_plan_templates_updated_at
    BEFORE UPDATE ON week_plan_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
