-- ============================================================
-- PHASE: National Holidays
-- ============================================================

CREATE TABLE IF NOT EXISTS national_holidays (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    holiday_date DATE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE national_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read national holidays" ON national_holidays FOR SELECT USING (true);

CREATE POLICY "Admin manage national holidays" ON national_holidays 
FOR ALL USING (auth.uid() IN (SELECT id FROM admin_profiles WHERE role IN ('Super Admin', 'Branch Manager')));
