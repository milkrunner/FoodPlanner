-- Meal Prep Enhancements
-- Adds support for marking recipes as meal-prep friendly and storing prep plans on week plans

ALTER TABLE recipes
    ADD COLUMN IF NOT EXISTS is_meal_prep_suitable BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS meal_prep_fridge_days INTEGER,
    ADD COLUMN IF NOT EXISTS meal_prep_freezer_days INTEGER,
    ADD COLUMN IF NOT EXISTS meal_prep_reheat_tips TEXT,
    ADD COLUMN IF NOT EXISTS meal_prep_batch_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_recipes_meal_prep
    ON recipes (is_meal_prep_suitable)
    WHERE is_meal_prep_suitable = TRUE;

COMMENT ON COLUMN recipes.is_meal_prep_suitable IS 'True if the recipe is suitable for batch cooking / meal prep.';
COMMENT ON COLUMN recipes.meal_prep_fridge_days IS 'Suggested maximum fridge storage in days for prepped portions.';
COMMENT ON COLUMN recipes.meal_prep_freezer_days IS 'Suggested maximum freezer storage in days for prepped portions.';
COMMENT ON COLUMN recipes.meal_prep_reheat_tips IS 'Tips for reheating the meal-prepped recipe.';
COMMENT ON COLUMN recipes.meal_prep_batch_notes IS 'General notes for batch cooking this recipe.';

ALTER TABLE week_plans
    ADD COLUMN IF NOT EXISTS meal_prep_plan JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN week_plans.meal_prep_plan IS 'JSON payload storing meal prep session planning data for this week plan.';
