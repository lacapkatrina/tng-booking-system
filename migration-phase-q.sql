-- ============================================================
-- PHASE Q: Product Review Display Settings
-- ============================================================

CREATE TABLE IF NOT EXISTS product_review_settings (
    product_id uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    show_reviews boolean DEFAULT true,
    show_rating_summary boolean DEFAULT true,
    show_review_count boolean DEFAULT true,
    show_booked_count boolean DEFAULT true,
    review_sort_order text DEFAULT 'newest' CHECK (review_sort_order IN ('newest', 'highest_rating', 'lowest_rating')),
    max_reviews_to_show integer DEFAULT 10,
    rating_source text DEFAULT 'auto' CHECK (rating_source IN ('auto', 'manual_override')),
    review_count_source text DEFAULT 'auto' CHECK (review_count_source IN ('auto', 'manual_override')),
    booked_count_source text DEFAULT 'auto' CHECK (booked_count_source IN ('auto', 'manual_override')),
    displayed_rating numeric(3,1),
    displayed_review_count integer,
    displayed_booked_count integer,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE product_review_settings ENABLE ROW LEVEL SECURITY;

-- Allow public to read the settings
CREATE POLICY "Public read review settings"
ON product_review_settings FOR SELECT
TO public
USING (true);

-- Allow authenticated admins to manage settings
CREATE POLICY "Admin manage review settings"
ON product_review_settings FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Utility to create a default settings row when a product is created
CREATE OR REPLACE FUNCTION trg_create_product_review_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO product_review_settings (product_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_product_review_settings ON products;
CREATE TRIGGER trg_new_product_review_settings
AFTER INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION trg_create_product_review_settings();

-- Backfill settings for existing products
INSERT INTO product_review_settings (product_id)
SELECT id FROM products
ON CONFLICT DO NOTHING;
