-- Shopping Budget and Optimization Settings

-- Budget settings table
CREATE TABLE IF NOT EXISTS shopping_budget (
    id SERIAL PRIMARY KEY,
    week_start DATE NOT NULL UNIQUE,
    budget_amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Saved substitutions (user preferences for future use)
CREATE TABLE IF NOT EXISTS substitution_preferences (
    id SERIAL PRIMARY KEY,
    original_ingredient TEXT NOT NULL,
    substitute_ingredient TEXT NOT NULL,
    reason TEXT,
    savings_percent INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint to avoid duplicate substitution preferences
CREATE UNIQUE INDEX IF NOT EXISTS idx_substitution_unique
    ON substitution_preferences(LOWER(original_ingredient), LOWER(substitute_ingredient));

CREATE INDEX IF NOT EXISTS idx_shopping_budget_week ON shopping_budget(week_start DESC);
