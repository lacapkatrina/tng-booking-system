-- ==========================================================================================
-- PHASE AC: Add foreign key constraints to bookings table for PostgREST joins
-- ==========================================================================================

-- Adding foreign key to products
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'bookings_product_id_fkey' 
    AND table_name = 'bookings'
  ) THEN
    ALTER TABLE bookings 
    ADD CONSTRAINT bookings_product_id_fkey 
    FOREIGN KEY (product_id) 
    REFERENCES products(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Adding foreign key to business_units
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'bookings_business_unit_id_fkey' 
    AND table_name = 'bookings'
  ) THEN
    ALTER TABLE bookings 
    ADD CONSTRAINT bookings_business_unit_id_fkey 
    FOREIGN KEY (business_unit_id) 
    REFERENCES business_units(id) ON DELETE SET NULL;
  END IF;
END $$;
