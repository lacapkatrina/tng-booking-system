-- ============================================================
-- PHASE: Date-Based Pricing Structure
-- ============================================================

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS weekday_price numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS weekend_price numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS holiday_price numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pricing_mode text DEFAULT 'fixed'; -- 'fixed', 'date_based'

-- Update existing products to have weekday_price = base_price
UPDATE products SET weekday_price = base_price, pricing_mode = 'fixed';
