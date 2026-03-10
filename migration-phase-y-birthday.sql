-- PHASE Y: Birthday Promo Setup

-- Add Birthday Promo constraints to promo_codes
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS is_birthday_promo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS birthday_promo_rule TEXT, -- 'actual_day', 'birthday_week', 'birthday_month'
  ADD COLUMN IF NOT EXISTS requires_companions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valid_business_units UUID[]; -- Array of branch IDs

-- Add Birthday Promo capture fields to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS celebrant_name TEXT,
  ADD COLUMN IF NOT EXISTS celebrant_birth_date DATE,
  ADD COLUMN IF NOT EXISTS presented_id_type TEXT,
  ADD COLUMN IF NOT EXISTS birthday_verification_status TEXT DEFAULT 'pending'; -- pending, passed, failed, escalated
