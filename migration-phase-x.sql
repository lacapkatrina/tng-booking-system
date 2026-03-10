-- ============================================================
-- PHASE X: Admin User Management & Roles (Phase 6.2 & 6.3)
-- Upgrade User Statuses and Build RBAC (Role-Based Access Control)
-- ============================================================

-- Phase 6.2: Adjust Status Rules
ALTER TABLE admin_profiles DROP CONSTRAINT IF EXISTS admin_profiles_status_check;
ALTER TABLE admin_profiles ADD CONSTRAINT admin_profiles_status_check 
CHECK (status IN ('Pending Approval', 'Active', 'Suspended', 'Deactivated'));


-- Phase 6.3: Rules and Permission System

-- 1. Create Permissions Dictionary Table
CREATE TABLE IF NOT EXISTS permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category text NOT NULL,
    key_name text UNIQUE NOT NULL,
    description text
);

-- 2. Create Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    description text
);

-- 3. Create Mapping (Many-to-Many Roles -> Permissions)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
    permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 4. Map Admin Profiles directly to Roles instead of text fields
ALTER TABLE admin_profiles ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES roles(id) ON DELETE SET NULL;


-- Add basic RLS so the admin system can read these normally
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Permissions" ON permissions FOR SELECT USING (true);
CREATE POLICY "Public Read Roles" ON roles FOR SELECT USING (true);
CREATE POLICY "Public Read Role_Permissions" ON role_permissions FOR SELECT USING (true);
CREATE POLICY "Admin All Access Permissions" ON permissions FOR ALL USING (true);
CREATE POLICY "Admin All Access Roles" ON roles FOR ALL USING (true);
CREATE POLICY "Admin All Access Role_Permissions" ON role_permissions FOR ALL USING (true);


-- 5. Seed Permissions Keys requested by user
INSERT INTO permissions (category, key_name, description) VALUES
-- User Management
('User Management', 'view_users', 'View system users'),
('User Management', 'approve_users', 'Approve pending users'),
('User Management', 'edit_users', 'Edit user details'),
('User Management', 'assign_roles', 'Assign roles to users'),
('User Management', 'assign_branches', 'Assign branches to users'),
('User Management', 'suspend_users', 'Suspend users'),
('User Management', 'deactivate_users', 'Deactivate users'),

-- Booking
('Booking', 'view_bookings', 'View all bookings'),
('Booking', 'create_bookings', 'Create new bookings'),
('Booking', 'edit_bookings', 'Edit existing bookings'),
('Booking', 'cancel_bookings', 'Cancel bookings'),
('Booking', 'confirm_bookings', 'Confirm bookings manually'),
('Booking', 'manage_availability', 'Manage slot availability'),
('Booking', 'block_dates', 'Block dates or closures'),

-- Finance
('Finance', 'view_payments', 'View payment records'),
('Finance', 'verify_payments', 'Verify payment status manually'),
('Finance', 'mark_paid', 'Mark bookings as paid'),
('Finance', 'process_refunds', 'Process or log refunds'),
('Finance', 'export_finance_reports', 'Export finance logs'),
('Finance', 'view_financial_summary', 'View high-level finance summary'),

-- Reports
('Reports', 'view_operational_reports', 'View operations logic'),
('Reports', 'view_finance_reports', 'View finance analytics'),
('Reports', 'export_reports', 'Export general reports'),

-- System
('System', 'manage_promos', 'Manage promo campaigns'),
('System', 'manage_settings', 'Manage business unit settings'),
('System', 'view_audit_logs', 'View system audit logs')
ON CONFLICT (key_name) DO NOTHING;


-- 6. Seed Default Roles
INSERT INTO roles (name, description) VALUES
('Admin', 'Full system access'),
('Booking Manager', 'Manages bookings and availability'),
('Finance', 'Handles payments and financial reports')
ON CONFLICT (name) DO NOTHING;


-- 7. Dynamically assign all existing keys to the 'Admin' role as a baseline
-- This will ensure whoever gets 'Admin' automatically holds every key.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;

-- Grant 'Booking Manager' only the Booking module keys
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Booking Manager' AND p.category = 'Booking'
ON CONFLICT DO NOTHING;

-- Grant 'Finance' only the Finance module keys
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Finance' AND p.category = 'Finance'
ON CONFLICT DO NOTHING;
