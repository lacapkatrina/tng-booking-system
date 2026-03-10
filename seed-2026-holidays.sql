-- Seed 2026 Philippine National Holidays
-- Insert into 'national_holidays' table.
-- Using 'ON CONFLICT DO NOTHING' assuming 'holiday_date' is UNIQUE.

INSERT INTO national_holidays (holiday_date, name) VALUES
    ('2026-01-01', 'New Year''s Day'),
    ('2026-02-17', 'Chinese New Year'),
    ('2026-02-25', 'EDSA People Power Revolution Anniversary'),
    ('2026-03-20', 'Eid''l Fitr (Approximate)'),
    ('2026-04-02', 'Maundy Thursday'),
    ('2026-04-03', 'Good Friday'),
    ('2026-04-04', 'Black Saturday'),
    ('2026-04-09', 'Araw ng Kagitingan'),
    ('2026-05-01', 'Labor Day'),
    ('2026-05-27', 'Eid''l Adha (Approximate)'),
    ('2026-06-12', 'Independence Day'),
    ('2026-08-21', 'Ninoy Aquino Day'),
    ('2026-08-31', 'National Heroes Day'),
    ('2026-11-01', 'All Saints'' Day'),
    ('2026-11-02', 'All Souls'' Day'),
    ('2026-11-30', 'Bonifacio Day'),
    ('2026-12-08', 'Feast of the Immaculate Conception of Mary'),
    ('2026-12-24', 'Christmas Eve'),
    ('2026-12-25', 'Christmas Day'),
    ('2026-12-30', 'Rizal Day'),
    ('2026-12-31', 'Last Day of the Year')
ON CONFLICT (holiday_date) DO NOTHING;
