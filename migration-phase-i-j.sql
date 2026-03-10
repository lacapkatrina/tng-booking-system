-- ============================================================
-- PHASE I: Product Resource Rules Upgrade
-- (decimal units + time windows)
-- ============================================================

-- 1. Change units_consumed from integer to numeric (supports 0.5, etc.)
ALTER TABLE product_resource_rules 
ALTER COLUMN units_consumed TYPE numeric;

-- 2. Add time window columns (if they don't exist yet)
DO $$ BEGIN
    ALTER TABLE product_resource_rules ADD COLUMN time_start time;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE product_resource_rules ADD COLUMN time_end time;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- PHASE J: Storage Bucket for Product Image Uploads
-- ============================================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('product_images', 'product_images', true) 
ON CONFLICT (id) DO NOTHING;

-- Public read access
DROP POLICY IF EXISTS "public read product_images" ON storage.objects;
CREATE POLICY "public read product_images" ON storage.objects 
FOR SELECT USING (bucket_id = 'product_images');

-- Anon insert (upload) access
DROP POLICY IF EXISTS "anon insert product_images" ON storage.objects;
CREATE POLICY "anon insert product_images" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'product_images');

-- Anon update access
DROP POLICY IF EXISTS "anon update product_images" ON storage.objects;
CREATE POLICY "anon update product_images" ON storage.objects 
FOR UPDATE USING (bucket_id = 'product_images');

-- Anon delete access
DROP POLICY IF EXISTS "anon delete product_images" ON storage.objects;
CREATE POLICY "anon delete product_images" ON storage.objects 
FOR DELETE USING (bucket_id = 'product_images');
