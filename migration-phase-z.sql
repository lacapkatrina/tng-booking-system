-- ============================================================
-- PHASE Z: Activate Root Admin Account
-- Ensure kay@thenextperience.com is fully approved with Root Access
-- ============================================================

-- Force the profile to 'Active' and assign the root 'Admin' role ID
UPDATE admin_profiles
SET 
    status = 'Active',
    role_id = (SELECT id FROM roles WHERE name = 'Admin' LIMIT 1)
WHERE email = 'kay@thenextperience.com' OR email = 'kay@thenextperience.com';

-- Automatically blast branch access logic so you don't hit a blank page:
-- Binds 'kay' to every single business unit actively existing on the platform.
INSERT INTO admin_user_branches (admin_id, business_unit_id)
SELECT a.id, b.id
FROM admin_profiles a
CROSS JOIN business_units b
WHERE a.email = 'kay@thenextperience.com'
ON CONFLICT DO NOTHING;
