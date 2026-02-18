-- Pantry / Ingredient Inventory
-- Adds a table for tracking available food items with expiration dates

CREATE TABLE IF NOT EXISTS pantry_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 3),
    unit VARCHAR(50),
    category VARCHAR(100),
    location VARCHAR(100),
    purchase_date DATE,
    expiry_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pantry_items_expiry
    ON pantry_items (expiry_date)
    WHERE expiry_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pantry_items_category
    ON pantry_items (category)
    WHERE category IS NOT NULL;

COMMENT ON TABLE pantry_items IS 'Available food items in the pantry/fridge with optional expiration tracking.';
COMMENT ON COLUMN pantry_items.quantity IS 'Numeric quantity of the item (e.g. 2.5).';
COMMENT ON COLUMN pantry_items.unit IS 'Unit of the quantity (e.g. kg, Stück, ml).';
COMMENT ON COLUMN pantry_items.category IS 'Category such as Gemüse, Fleisch, Milchprodukte, etc.';
COMMENT ON COLUMN pantry_items.location IS 'Storage location: Kühlschrank, Tiefkühler, Vorratsschrank, etc.';
COMMENT ON COLUMN pantry_items.purchase_date IS 'Date the item was purchased.';
COMMENT ON COLUMN pantry_items.expiry_date IS 'Best-before or use-by date.';
