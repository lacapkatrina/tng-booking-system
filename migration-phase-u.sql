-- ============================================================
-- PHASE U: Promo Code Engine (Phase 3 - Referral and Affiliate)
-- Extend the promo engine to support marketing partner codes.
-- ============================================================

-- 1. Add referral/affiliate fields to promo_codes
ALTER TABLE promo_codes
ADD COLUMN IF NOT EXISTS promo_category text DEFAULT 'standard' CHECK (promo_category IN ('standard', 'referral', 'affiliate', 'partner', 'influencer')),
ADD COLUMN IF NOT EXISTS referrer_name text,
ADD COLUMN IF NOT EXISTS referrer_type text,
ADD COLUMN IF NOT EXISTS referrer_reward_type text,
ADD COLUMN IF NOT EXISTS referrer_reward_value numeric;

-- 2. Create the promo_referrals tracking table
CREATE TABLE IF NOT EXISTS promo_referrals (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    promo_code_id uuid REFERENCES promo_codes(id) ON DELETE CASCADE,
    booking_id bigint REFERENCES bookings(id) ON DELETE CASCADE,
    referrer_name text,
    referrer_type text,
    reward_value numeric,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS logic for the new tracking table
ALTER TABLE promo_referrals ENABLE ROW LEVEL SECURITY;

-- Allow public inserts for our unauthenticated checkout flow
CREATE POLICY "Public insert access for promo_referrals" ON promo_referrals
FOR INSERT WITH CHECK (true);

-- Allow admin full access
CREATE POLICY "Admin full access for promo_referrals" ON promo_referrals
FOR ALL USING (true);


-- 3. Provide seed examples for testing
INSERT INTO promo_codes (code, promo_reward_type, discount_value, promo_category, referrer_name, referrer_type, referrer_reward_type, referrer_reward_value, active)
VALUES 
    ('KATRINA20', 'fixed_discount', 500, 'influencer', 'Katrina Bella', 'social_media', 'cash', 150, true),
    ('FRIEND10', 'percentage_discount', 10, 'referral', 'Loyal Customer', 'customer', 'credits', 100, true)
ON CONFLICT (code) DO UPDATE SET
    promo_reward_type = EXCLUDED.promo_reward_type,
    discount_value = EXCLUDED.discount_value,
    promo_category = EXCLUDED.promo_category,
    referrer_name = EXCLUDED.referrer_name,
    referrer_type = EXCLUDED.referrer_type,
    referrer_reward_type = EXCLUDED.referrer_reward_type,
    referrer_reward_value = EXCLUDED.referrer_reward_value;
