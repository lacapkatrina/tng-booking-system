-- ============================================================
-- PHASE T: Promo Code Engine (Phase 2 - Buy X Get Y)
-- Extending promo system with quantity logic
-- ============================================================

-- Add new fields to promo_codes
ALTER TABLE promo_codes
ADD COLUMN IF NOT EXISTS buy_quantity integer,
ADD COLUMN IF NOT EXISTS free_quantity integer,
ADD COLUMN IF NOT EXISTS target_type text CHECK (target_type IN ('ticket', 'add_on', 'time_extension')),
ADD COLUMN IF NOT EXISTS target_product_id uuid REFERENCES products(id),
ADD COLUMN IF NOT EXISTS target_add_on_id uuid REFERENCES addons(id);

-- Update bookings to handle additional granted items or specific promo logic if necessary,
-- but typically we just record the same discount_amount (if any) and the promo ID.
-- However, for buy X get Y, the discount amount is technically the value of the free item,
-- OR it is zero and the items are just added. We can keep discount_amount = 0 and just log the code.

-- Provide seed examples for testing
INSERT INTO promo_codes (code, promo_reward_type, buy_quantity, free_quantity, target_type, active)
VALUES 
    ('B1T1', 'buy_x_get_y', 1, 1, 'ticket', true),
    ('BUY5GET1', 'buy_x_get_y', 5, 1, 'ticket', true),
    ('3HOURS1FREE', 'buy_x_get_y', 3, 1, 'time_extension', true)
ON CONFLICT (code) DO UPDATE SET
    promo_reward_type = EXCLUDED.promo_reward_type,
    buy_quantity = EXCLUDED.buy_quantity,
    free_quantity = EXCLUDED.free_quantity,
    target_type = EXCLUDED.target_type;
