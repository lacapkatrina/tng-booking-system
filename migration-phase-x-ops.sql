-- PHASE X-OPS: Redemption and Scanning

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS redemption_status TEXT DEFAULT 'not_claimed', --  not_claimed, partially_claimed, fully_claimed, cancelled, expired, no_show
  ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scanned_by UUID; -- References auth.users 

ALTER TABLE booking_addons
  ADD COLUMN IF NOT EXISTS redemption_status TEXT DEFAULT 'not_claimed', -- not_claimed, claimed, voided
  ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scanned_by UUID;

-- We can add offline sync logs here if needed in the future
CREATE TABLE IF NOT EXISTS scan_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_payload JSONB,
    scanned_at TIMESTAMPTZ DEFAULT now(),
    scanned_by UUID,
    status TEXT, -- success, invalid, wrong_date, already_redeemed
    synced_to_server BOOLEAN DEFAULT true
);
