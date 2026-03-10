-- PHASE Z: Birthday Verification Audit & Safeguards

CREATE TABLE IF NOT EXISTS birthday_approval_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id BIGINT REFERENCES bookings(id),
    scanned_by UUID REFERENCES auth.users(id),
    branch_id UUID REFERENCES business_units(id),
    captured_name_text TEXT,
    captured_dob_text TEXT,
    presented_id_type TEXT,
    match_result_name TEXT,
    match_result_dob TEXT,
    verification_status TEXT, -- verified, rejected, escalated, manager_override
    override_reason TEXT,
    override_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
