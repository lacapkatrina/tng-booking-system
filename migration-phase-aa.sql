-- ============================================================
-- PHASE AA: Add slug to business_units for routing
-- ============================================================

ALTER TABLE business_units ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- create basic slugs from names if missing
UPDATE business_units 
SET slug = lower(trim(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'), '-'))
WHERE slug IS NULL;

-- Make slug required for future inserts
ALTER TABLE business_units ALTER COLUMN slug SET NOT NULL;
