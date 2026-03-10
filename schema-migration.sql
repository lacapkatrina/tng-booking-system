-- SCHEMA MIGRATION SCRIPT FOR TNG BOOKING SYSTEM
-- SAFE MIGRATION: Extends current tables and adds new ones. Does not destroy or rename existing data.

-- ==========================================================================================
-- PHASE B: Apply non-destructive schema updates to 'bookings' table
-- ==========================================================================================
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS business_unit_id uuid,
ADD COLUMN IF NOT EXISTS product_id uuid,
ADD COLUMN IF NOT EXISTS booking_reference text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS start_at timestamptz,
ADD COLUMN IF NOT EXISTS end_at timestamptz,
ADD COLUMN IF NOT EXISTS customer_phone text,
ADD COLUMN IF NOT EXISTS inventory_mode text,
ADD COLUMN IF NOT EXISTS xendit_reference text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ==========================================================================================
-- PHASE E: Create supporting tables
-- ==========================================================================================

CREATE TABLE IF NOT EXISTS business_units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    code text,
    timezone text,
    currency text,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id uuid REFERENCES business_units(id),
    name text NOT NULL,
    capacity integer DEFAULT 1,
    location text,
    resource_type text,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id uuid REFERENCES business_units(id),
    name text NOT NULL,
    description text,
    booking_type text,
    duration_minutes integer,
    base_price numeric DEFAULT 0,
    inventory_mode text,
    product_capacity integer DEFAULT 1,
    slot_template_id uuid, -- Will reference slot_templates once created
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slot_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id uuid REFERENCES business_units(id),
    name text NOT NULL,
    start_time time,
    end_time time,
    interval_minutes integer,
    buffer_before_minutes integer DEFAULT 0,
    buffer_after_minutes integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Add the foreign key constraint now that slot_templates exists
ALTER TABLE products DROP CONSTRAINT IF EXISTS fk_products_slot_template_id;
ALTER TABLE products
ADD CONSTRAINT fk_products_slot_template_id
FOREIGN KEY (slot_template_id) REFERENCES slot_templates(id);

CREATE TABLE IF NOT EXISTS product_resource_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid REFERENCES products(id),
    resource_id uuid REFERENCES resources(id),
    units_consumed numeric DEFAULT 1,        -- supports 0.5 for half-day passes
    time_start time,                          -- optional: resource occupied from this time
    time_end time,                            -- optional: resource occupied until this time
    created_at timestamptz DEFAULT now()
);

-- Migration: alter existing column if it was integer
DO $$ BEGIN
    ALTER TABLE product_resource_rules ALTER COLUMN units_consumed TYPE numeric;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Migration: add time columns if missing
DO $$ BEGIN
    ALTER TABLE product_resource_rules ADD COLUMN time_start time;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE product_resource_rules ADD COLUMN time_end time;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS booking_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id int8 REFERENCES bookings(id), -- Assuming bookings.id is int8 per Supabase default
    resource_id uuid REFERENCES resources(id),
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    units_reserved integer DEFAULT 1,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id int8 REFERENCES bookings(id),
    xendit_reference text,
    amount numeric NOT NULL,
    payment_method text,
    status text DEFAULT 'pending',
    paid_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- ==========================================================================================
-- Add indexes for performance & availability logic
-- ==========================================================================================

CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_start_at ON bookings(start_at);
CREATE INDEX IF NOT EXISTS idx_bookings_end_at ON bookings(end_at);
CREATE INDEX IF NOT EXISTS idx_bookings_business_unit_id ON bookings(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_bookings_product_id ON bookings(product_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);

CREATE INDEX IF NOT EXISTS idx_allocations_resource_id ON booking_allocations(resource_id);
CREATE INDEX IF NOT EXISTS idx_allocations_start_at ON booking_allocations(start_at);
CREATE INDEX IF NOT EXISTS idx_allocations_end_at ON booking_allocations(end_at);

-- ==========================================================================================
-- PHASE F: Payment Gateway Settings (Scoping Xendit per BU)
-- ==========================================================================================

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

CREATE INDEX IF NOT EXISTS idx_payment_gateway_settings_bu_id ON payment_gateway_settings(business_unit_id);

-- ==========================================================================================
-- PHASE G: Product Images (Klook-style galleries)
-- ==========================================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls text[];

-- ==========================================================================================
-- PHASE H: Business Closures (Block Dates, Closing Periods)
-- ==========================================================================================

CREATE TABLE IF NOT EXISTS closure_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id uuid REFERENCES business_units(id) NOT NULL,
    scope_type text NOT NULL, -- 'business_unit', 'product', 'resource'
    scope_id uuid, -- nullable, references product id or resource id based on scope_type
    closure_type text NOT NULL, -- 'full_day', 'partial_day', 'date_range', 'recurring'
    start_date date,
    end_date date,
    start_time time,
    end_time time,
    recurrence_rule text, -- JSON string or specific logic string
    reason text,
    is_hard_block boolean DEFAULT true,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_closure_rules_bu_id ON closure_rules(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_closure_rules_scope ON closure_rules(scope_type, scope_id);

-- ==========================================================================================
-- PHASE I: Storage for Product Images
-- ==========================================================================================

-- 1. Need to ensure the 'storage' schema and its tables exist. 
-- Assuming Supabase default storage schema is present:
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product_images', 'product_images', true) 
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies if any, then create them for the new bucket
DROP POLICY IF EXISTS "public read product_images" ON storage.objects;
CREATE POLICY "public read product_images" ON storage.objects 
FOR SELECT USING (bucket_id = 'product_images');

DROP POLICY IF EXISTS "anon insert product_images" ON storage.objects;
-- Using Anon here for simplicity as admin is client-side without auth tokens in this scratchpad
CREATE POLICY "anon insert product_images" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'product_images');

DROP POLICY IF EXISTS "anon update product_images" ON storage.objects;
CREATE POLICY "anon update product_images" ON storage.objects 
FOR UPDATE USING (bucket_id = 'product_images');

DROP POLICY IF EXISTS "anon delete product_images" ON storage.objects;
CREATE POLICY "anon delete product_images" ON storage.objects 
FOR DELETE USING (bucket_id = 'product_images');
