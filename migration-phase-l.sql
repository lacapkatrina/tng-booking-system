-- ============================================================
-- PHASE L: Add-ons System
-- ============================================================

-- 1. Add-ons Table
CREATE TABLE IF NOT EXISTS addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_unit_id UUID REFERENCES business_units(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Product <-> Add-ons Junction Table
CREATE TABLE IF NOT EXISTS product_addons (
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    addon_id UUID REFERENCES addons(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, addon_id)
);

-- 3. Booking Add-ons (Records what was purchased)
CREATE TABLE IF NOT EXISTS booking_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id BIGINT REFERENCES bookings(id) ON DELETE CASCADE,
    addon_id UUID REFERENCES addons(id) ON DELETE SET NULL,
    addon_name TEXT NOT NULL, -- Keep name in case addon is deleted
    quantity INTEGER NOT NULL DEFAULT 1,
    price_at_booking NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Add read policies (Assuming anonymous read for public booking forms)
ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for active addons" ON addons FOR SELECT USING (active = true);
CREATE POLICY "Public read access for product_addons" ON product_addons FOR SELECT USING (true);
CREATE POLICY "Public insert access for booking_addons" ON booking_addons FOR INSERT WITH CHECK (true);

-- Enable all access for authenticated users/admins (Simplified for mockup)
CREATE POLICY "All access addons" ON addons FOR ALL USING (true);
CREATE POLICY "All access product_addons" ON product_addons FOR ALL USING (true);
CREATE POLICY "All access booking_addons admin" ON booking_addons FOR ALL USING (true);
