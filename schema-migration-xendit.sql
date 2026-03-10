-- SCHEMA MIGRATION SCRIPT FOR TNG BOOKING SYSTEM - XENDIT SETTINGS
-- SAFE MIGRATION: Creates payment_gateway_settings table

CREATE TABLE IF NOT EXISTS payment_gateway_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id uuid REFERENCES business_units(id) NOT NULL,
    gateway_name text NOT NULL, -- e.g., 'xendit'
    active boolean DEFAULT false,
    test_mode boolean DEFAULT true,
    api_key_encrypted text,
    webhook_secret_encrypted text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(business_unit_id, gateway_name)
);

-- Index for fast lookup by business unit
CREATE INDEX IF NOT EXISTS idx_payment_gateway_settings_bu_id ON payment_gateway_settings(business_unit_id);
