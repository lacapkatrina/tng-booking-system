-- ============================================================
-- PHASE 7: Automated Review Requests
-- ============================================================

-- Add a column to track when the review request email was sent
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS review_email_sent_at timestamptz;

-- Create an index to quickly find bookings missing a review email
CREATE INDEX IF NOT EXISTS idx_bookings_review_email_sent 
ON bookings (review_email_sent_at) 
WHERE review_email_sent_at IS NULL AND payment_status = 'paid' AND status != 'cancelled';
