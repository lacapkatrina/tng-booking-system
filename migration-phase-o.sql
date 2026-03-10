-- ============================================================
-- PHASE O: Product Review System
-- ============================================================

CREATE TABLE IF NOT EXISTS product_reviews (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core relationships
    product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    booking_id      bigint REFERENCES bookings(id) ON DELETE SET NULL,

    -- Reviewer info
    customer_name   text,                          -- from booking, copied at submit time
    customer_email  text,                          -- from booking, copied at submit time
    display_name    text,                          -- what shows publicly (may differ)
    is_anonymous    boolean NOT NULL DEFAULT false, -- if true, show "Anonymous Guest"

    -- Review content
    rating          smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title           text,
    review_text     text,
    photos_json     jsonb DEFAULT '[]'::jsonb,     -- array of public image URLs

    -- Moderation workflow
    -- Statuses: pending | approved | hidden | rejected
    status          text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'hidden', 'rejected')),
    is_featured     boolean NOT NULL DEFAULT false,

    -- Timestamps & audit
    submitted_at    timestamptz NOT NULL DEFAULT now(),
    approved_at     timestamptz,
    approved_by     text,                          -- admin email who actioned it
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_reviews_product    ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking    ON product_reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status     ON product_reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_featured   ON product_reviews(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_reviews_rating     ON product_reviews(product_id, rating) WHERE status = 'approved';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_reviews_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON product_reviews;
CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON product_reviews
    FOR EACH ROW EXECUTE FUNCTION update_reviews_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- Public can read approved reviews only
CREATE POLICY "Public read approved reviews"
    ON product_reviews FOR SELECT
    USING (status = 'approved');

-- Authenticated users (admins) can read all reviews
CREATE POLICY "Admin read all reviews"
    ON product_reviews FOR SELECT
    TO authenticated
    USING (true);

-- Authenticated admins can update (approve/hide/reject/feature)
CREATE POLICY "Admin update reviews"
    ON product_reviews FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Public can insert (submit) reviews — we'll validate server-side
CREATE POLICY "Public submit reviews"
    ON product_reviews FOR INSERT
    WITH CHECK (true);

-- Admin can delete reviews
CREATE POLICY "Admin delete reviews"
    ON product_reviews FOR DELETE
    TO authenticated
    USING (true);
