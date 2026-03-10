-- ============================================================
-- PHASE AB: Business Unit Access Control & User Management
-- (Phase 6.6 & 6.7 implementation)
-- ============================================================

-- 1. Extend admin_profiles with metadata and scope control
ALTER TABLE admin_profiles 
ADD COLUMN IF NOT EXISTS access_all_business_units boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES admin_profiles(id),
ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- 2. Update existing Admin user to have full access
-- Assuming the admin created in previous migrations (kay@thenextperience.com) should have full access.
UPDATE admin_profiles 
SET access_all_business_units = true, status = 'Active'
WHERE email = 'kay@thenextperience.com';

-- 3. Create a helper function to check BU access in RLS
CREATE OR REPLACE FUNCTION public.check_bu_access(target_bu_id uuid)
RETURNS boolean AS $$
DECLARE
  u_status text;
  u_all boolean;
  u_role text;
BEGIN
  -- Get user profile and role info
  SELECT p.status, p.access_all_business_units, r.name 
  INTO u_status, u_all, u_role
  FROM public.admin_profiles p
  LEFT JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = auth.uid();

  -- Safeguard: If user not active, deny access
  IF u_status IS NULL OR u_status != 'Active' THEN
    RETURN false;
  END IF;

  -- If global access flag is set or they have the 'Admin' role, allow all
  IF u_all = true OR u_role = 'Admin' THEN
    RETURN true;
  END IF;

  -- Otherwise, check for specific branch assignment
  RETURN EXISTS (
    SELECT 1 FROM public.admin_user_branches 
    WHERE admin_id = auth.uid() AND business_unit_id = target_bu_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply BU-based RLS to key tables
-- We need to update existing policies or add new ones.

-- Note: This is an additive migration. If policies already exist, we might need to DROP/CREATE them.
-- For the sake of this phase, let's ensure the policies are restrictive.

-- Bookings RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BU based bookings access" ON bookings;
CREATE POLICY "BU based bookings access" ON bookings
FOR ALL USING (
    check_bu_access(business_unit_id)
);

-- Products RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BU based products access" ON products;
CREATE POLICY "BU based products access" ON products
FOR ALL USING (
    check_bu_access(business_unit_id)
);

-- Addons RLS
ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BU based addons access" ON addons;
CREATE POLICY "BU based addons access" ON addons
FOR ALL USING (
    check_bu_access(business_unit_id)
);

-- Slot Templates RLS
ALTER TABLE slot_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BU based slots access" ON slot_templates;
CREATE POLICY "BU based slots access" ON slot_templates
FOR ALL USING (
    check_bu_access(business_unit_id)
);

-- Payment Gateway Settings RLS
ALTER TABLE payment_gateway_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BU based gateway access" ON payment_gateway_settings;
CREATE POLICY "BU based gateway access" ON payment_gateway_settings
FOR ALL USING (
    check_bu_access(business_unit_id)
);

-- Resources RLS
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BU based resources access" ON resources;
CREATE POLICY "BU based resources access" ON resources
FOR ALL USING (
    check_bu_access(business_unit_id)
);

-- Product Resource Rules RLS
ALTER TABLE product_resource_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BU based rules access" ON product_resource_rules;
CREATE POLICY "BU based rules access" ON product_resource_rules
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.id = product_resource_rules.product_id AND check_bu_access(p.business_unit_id)
    )
);

-- Closure Rules RLS
ALTER TABLE closure_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BU based closures access" ON closure_rules;
CREATE POLICY "BU based closures access" ON closure_rules
FOR ALL USING (
    check_bu_access(business_unit_id)
);

-- Product Reviews RLS
-- Reviews are usually linked to products, which are linked to BUs
-- We might need a slightly different check if the table doesn't have business_unit_id directly
-- Let's check schema for product_reviews.
-- It has product_id. We can check via product.

DROP POLICY IF EXISTS "BU based reviews access" ON product_reviews;
CREATE POLICY "BU based reviews access" ON product_reviews
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM products p 
        WHERE p.id = product_reviews.product_id AND check_bu_access(p.business_unit_id)
    )
);

-- Business Units RLS
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "BU visibility" ON business_units;
CREATE POLICY "BU visibility" ON business_units
FOR SELECT USING (
    check_bu_access(id)
);

-- 5. User Management Page Metadata helper
-- Note: Admin profiles themselves should be visible to those with 'view_users' permission.
-- For simplicity in this demo, we keep the 'Public Read Roles' etc from Phase X.
