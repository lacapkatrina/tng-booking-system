-- ==========================================================================================
-- PHASE AD: Public Access Policies
-- Re-opening SELECT and INSERT permissions to front-end customers after Phase AB lockdown
-- ==========================================================================================

-- 1. Enable Public Reads on all Front-End Catalog Data
DO $$ BEGIN
    CREATE POLICY "Public read business units" ON business_units FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read addons" ON addons FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read product addons" ON product_addons FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read slot templates" ON slot_templates FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read reviews" ON product_reviews FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read review settings" ON product_review_settings FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read bu holidays" ON business_unit_holidays FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read price overrides" ON product_price_overrides FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public read promo codes" ON promo_codes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- 2. Allow Public INSERTS and UPDATES for the Checkout Flow
-- Customers must be able to insert bookings and update their status after payment
DO $$ BEGIN
    CREATE POLICY "Public insert bookings" ON bookings FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public update bookings" ON bookings FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public insert booking addons" ON booking_addons FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY "Public insert promo referrals" ON promo_referrals FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
