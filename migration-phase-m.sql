-- ============================================================
-- PHASE M: Add-ons Enhancements — Photo & Inventory
-- ============================================================

-- Add image URL for each add-on (displayed as a card photo)
ALTER TABLE addons ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add max inventory/stock per day. NULL means unlimited.
ALTER TABLE addons ADD COLUMN IF NOT EXISTS max_stock INTEGER DEFAULT NULL;
