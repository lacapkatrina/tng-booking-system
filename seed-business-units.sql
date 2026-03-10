-- SEED BUSINESS UNITS
-- Run this in your Supabase SQL Editor once to populate your Business Units
INSERT INTO business_units (name) 
VALUES 
    ('The Dessert Museum'),
    ('Inflatable Island'),
    ('Gootopia SMOA'),
    ('Gootopia SMNE'),
    ('Bakebe SM Aura'),
    ('Bakebe SMaison'),
    ('The Fun Roof')
ON CONFLICT DO NOTHING;
