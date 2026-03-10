-- ============================================================
-- PHASE Y: Admin User Profile Binding & Extra Permissions (Phase 6.4)
-- Connects admin_profiles to actual branches + adjusts permissions
-- ============================================================

-- 1. Create mapping for Business Unit access
CREATE TABLE IF NOT EXISTS admin_user_branches (
    admin_id uuid REFERENCES admin_profiles(id) ON DELETE CASCADE,
    business_unit_id uuid REFERENCES business_units(id) ON DELETE CASCADE,
    PRIMARY KEY (admin_id, business_unit_id)
);

-- Enable RLS
ALTER TABLE admin_user_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin All Access admin_user_branches" ON admin_user_branches FOR ALL USING (true);


-- 2. Validate/Add the missing overlapping permissions (Booking Manager getting view_operational_reports)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Booking Manager' AND p.key_name = 'view_operational_reports'
ON CONFLICT DO NOTHING;

-- Force all permissions mapped to 'Admin' just in case
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;
