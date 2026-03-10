-- ============================================================
-- PHASE 2: Date-Based Pricing & Overrides
-- ============================================================

-- Table for Business Unit Holidays (applicable to all products in a BU)
CREATE TABLE IF NOT EXISTS business_unit_holidays (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_unit_id uuid REFERENCES business_units(id) ON DELETE CASCADE,
    holiday_date DATE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(business_unit_id, holiday_date)
);

-- Table for Product-Specific Price Overrides (for exact dates)
CREATE TABLE IF NOT EXISTS product_price_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid REFERENCES products(id) ON DELETE CASCADE,
    business_unit_id uuid REFERENCES business_units(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    override_price NUMERIC NOT NULL,
    label TEXT, -- e.g., "Grand Opening Special", "Black Friday"
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(product_id, date)
);

-- RLS Policies
ALTER TABLE business_unit_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_overrides ENABLE ROW LEVEL SECURITY;

-- Public read for booking if business unit is public (simplified)
CREATE POLICY "Public read holidays" ON business_unit_holidays FOR SELECT USING (true);
CREATE POLICY "Public read price overrides" ON product_price_overrides FOR SELECT USING (true);

-- Admin write access
CREATE POLICY "Admin manage holidays" ON business_unit_holidays 
FOR ALL USING (auth.uid() IN (SELECT id FROM admin_profiles WHERE role IN ('Super Admin', 'Branch Manager', 'admin', 'super_admin')));

CREATE POLICY "Admin manage overrides" ON product_price_overrides 
FOR ALL USING (auth.uid() IN (SELECT id FROM admin_profiles WHERE role IN ('Super Admin', 'Branch Manager', 'admin', 'super_admin')));
