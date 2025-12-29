-- FoodPlanner PostgreSQL Schema
-- Migration: Cooking History (Kochverlauf)

-- Tabelle: cooking_history
-- Speichert wann welches Rezept gekocht wurde
CREATE TABLE IF NOT EXISTS cooking_history (
    id SERIAL PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    cooked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    servings INTEGER,
    notes TEXT
);

-- Indizes fuer bessere Performance
CREATE INDEX IF NOT EXISTS idx_cooking_history_recipe_id ON cooking_history(recipe_id);
CREATE INDEX IF NOT EXISTS idx_cooking_history_cooked_at ON cooking_history(cooked_at DESC);

-- View: Rezepte mit letztem Kochdatum und Anzahl
CREATE OR REPLACE VIEW recipe_cooking_stats AS
SELECT
    r.id as recipe_id,
    r.name as recipe_name,
    COUNT(ch.id) as times_cooked,
    MAX(ch.cooked_at) as last_cooked_at,
    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - MAX(ch.cooked_at))) as days_since_last_cooked
FROM recipes r
LEFT JOIN cooking_history ch ON r.id = ch.recipe_id
GROUP BY r.id, r.name;
