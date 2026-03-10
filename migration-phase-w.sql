-- PHASE W: Product Content & Confirmations

ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_message TEXT;
