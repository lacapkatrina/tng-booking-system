-- ============================================================
-- PHASE S: Promo Code Engine (Phase 1)
-- Core Promo Code System with monetary/percentage discounts
-- ============================================================

CREATE TABLE IF NOT EXISTS promo_codes (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                text NOT NULL UNIQUE,
    promo_reward_type   text NOT NULL CHECK (promo_reward_type IN ('fixed_discount', 'percentage_discount', 'buy_x_get_y', 'time_based', 'referral')),
    discount_value      numeric, -- the fixed amount or the percentage
    active              boolean NOT NULL DEFAULT true,
    
    -- Additional fields for tracking / validation
    max_uses            integer,
    uses_count          integer NOT NULL DEFAULT 0,
    valid_from          timestamptz,
    valid_until         timestamptz,
    
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by code
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);

-- Add promo tracking to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS promo_code_id uuid REFERENCES promo_codes(id),
ADD COLUMN IF NOT EXISTS promo_code_text text,
ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;

-- Row Level Security
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- Public can read active promo codes (to validate)
CREATE POLICY "Public read active promo codes"
    ON promo_codes FOR SELECT
    USING (active = true);

-- Authenticated users (admins) can read all
CREATE POLICY "Admin read all promo codes"
    ON promo_codes FOR SELECT
    TO authenticated
    USING (true);

-- Authenticated admins can update
CREATE POLICY "Admin update promo codes"
    ON promo_codes FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Authenticated admins can insert
CREATE POLICY "Admin insert promo codes"
    ON promo_codes FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Authenticated admins can delete
CREATE POLICY "Admin delete promo codes"
    ON promo_codes FOR DELETE
    TO authenticated
    USING (true);

-- Auto-update updated_at for promo_codes
CREATE OR REPLACE FUNCTION update_promo_codes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promo_codes_updated_at ON promo_codes;
CREATE TRIGGER trg_promo_codes_updated_at
    BEFORE UPDATE ON promo_codes
    FOR EACH ROW EXECUTE FUNCTION update_promo_codes_updated_at();

-- Provide a seed example for testing
INSERT INTO promo_codes (code, promo_reward_type, discount_value, active)
VALUES 
    ('SUMMER500', 'fixed_discount', 500, true),
    ('EARLY10', 'percentage_discount', 10, true)
ON CONFLICT (code) DO NOTHING;
