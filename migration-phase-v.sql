-- ============================================================
-- PHASE V: Promo Code Engine (Phase 4 - Admin Control & Campaign Management)
-- Build the backend admin system that allows full management of promo campaigns.
-- ============================================================

-- 1. Add fields to promo_codes for campaign tagging and abuse protection
ALTER TABLE promo_codes
ADD COLUMN IF NOT EXISTS campaign_name text,
ADD COLUMN IF NOT EXISTS max_total_uses integer,
ADD COLUMN IF NOT EXISTS max_uses_per_customer integer,
ADD COLUMN IF NOT EXISTS minimum_spend_amount numeric,
ADD COLUMN IF NOT EXISTS max_uses_per_day integer,
ADD COLUMN IF NOT EXISTS is_blacklisted boolean DEFAULT false;

-- 2. Create promo audit log tracking
CREATE TABLE IF NOT EXISTS promo_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id uuid REFERENCES promo_codes(id) ON DELETE CASCADE,
    action text, -- e.g., 'created', 'updated', 'activated', 'deactivated', 'blacklisted'
    admin_user text,
    timestamp timestamptz DEFAULT now(),
    notes text
);

-- RLS for audit logs
ALTER TABLE promo_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access for promo_audit_logs" ON promo_audit_logs
FOR ALL USING (true); -- Requires auth in real app, demo assumes true

-- Update bookings to handle free items representation if needed, though they go to booking_addons/promo_referrals normally.
