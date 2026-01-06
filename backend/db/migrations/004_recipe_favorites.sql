-- Favorites feature: track whether a recipe is marked as favorite
ALTER TABLE recipes
    ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure existing rows have a deterministic value
UPDATE recipes SET is_favorite = FALSE WHERE is_favorite IS NULL;

-- Index to accelerate favorite lookups
CREATE INDEX IF NOT EXISTS idx_recipes_favorite
    ON recipes (is_favorite)
    WHERE is_favorite = TRUE;
