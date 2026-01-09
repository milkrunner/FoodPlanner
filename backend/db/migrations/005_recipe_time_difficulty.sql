-- Migration: Add prep_time, cook_time, and difficulty to recipes
-- Issue #114: Zubereitungszeit & Schwierigkeitsgrad für Rezepte

-- Add new columns to recipes table
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS prep_time INTEGER;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cook_time INTEGER;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20);

-- Add index for difficulty filtering
CREATE INDEX IF NOT EXISTS idx_recipes_difficulty ON recipes(difficulty);

-- Add index for time-based filtering
CREATE INDEX IF NOT EXISTS idx_recipes_prep_time ON recipes(prep_time);
CREATE INDEX IF NOT EXISTS idx_recipes_cook_time ON recipes(cook_time);

-- Add comment for documentation
COMMENT ON COLUMN recipes.prep_time IS 'Preparation time in minutes';
COMMENT ON COLUMN recipes.cook_time IS 'Cooking time in minutes';
COMMENT ON COLUMN recipes.difficulty IS 'Difficulty level: Einfach, Mittel, Fortgeschritten';
