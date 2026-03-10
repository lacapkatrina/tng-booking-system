-- ============================================================
-- PHASE N: Multi-Slot Templates per Product
-- ============================================================
-- Allow a product to have multiple selectable time slots
-- (e.g., "Spray" with "AM 08:00–13:00" and "PM 13:00–18:00")

-- 1. Create the junction table
CREATE TABLE IF NOT EXISTS product_slot_templates (
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    slot_template_id UUID REFERENCES slot_templates(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0, -- Controls display order of chips
    PRIMARY KEY (product_id, slot_template_id)
);

-- 2. RLS
ALTER TABLE product_slot_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read product_slot_templates" ON product_slot_templates FOR SELECT USING (true);
CREATE POLICY "All access product_slot_templates" ON product_slot_templates FOR ALL USING (true);

-- 3. Backfill existing products that already have a slot_template_id set
-- (migrates the old 1:1 data into the new many-to-many structure)
INSERT INTO product_slot_templates (product_id, slot_template_id, sort_order)
SELECT id, slot_template_id, 0
FROM products
WHERE slot_template_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- NOTE: The products.slot_template_id column is kept for backwards compatibility
-- but the booking page will now use product_slot_templates as the source of truth.
-- You may drop it later with: ALTER TABLE products DROP COLUMN slot_template_id;
