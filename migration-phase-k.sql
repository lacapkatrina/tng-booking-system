-- ============================================================
-- PHASE K: Product Display Fields
-- (badge, value props, short tagline)
-- ============================================================

-- 1. Badge type for product cards
DO $$ BEGIN
    ALTER TABLE products ADD COLUMN badge_type text DEFAULT 'none';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Value propositions (Hormozi-style selling points)
DO $$ BEGIN
    ALTER TABLE products ADD COLUMN value_props text[];
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Short tagline for card display
DO $$ BEGIN
    ALTER TABLE products ADD COLUMN short_tagline text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add comment for reference
COMMENT ON COLUMN products.badge_type IS 'One of: none, most_popular, best_value, limited, new, recommended';
COMMENT ON COLUMN products.value_props IS 'Array of short value propositions, e.g. {"Full day access","Photo areas included"}';
COMMENT ON COLUMN products.short_tagline IS 'Short one-liner shown on product cards';
