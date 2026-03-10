-- ============================================================
-- PHASE P: Backend Computed Product Stats
--
-- Strategy: Three denormalized columns on the products table,
-- auto-maintained by triggers on product_reviews and bookings.
-- This means public pages get stats from a single products row
-- with no runtime aggregation cost.
--
-- Columns added to products:
--   actual_rating        NUMERIC(3,1)  -- avg of approved review ratings
--   actual_review_count  INTEGER       -- count of approved reviews
--   actual_booked_count  INTEGER       -- count of paid, non-cancelled bookings
--
-- Additionally creates:
--   product_stats_live   VIEW          -- live aggregation for admin/debugging
--   refresh_product_stats(uuid)        -- recalculate one product on demand
--   refresh_all_product_stats()        -- bulk recalculate all products
--   Triggers on product_reviews & bookings
-- ============================================================

-- ============================================================
-- 1. Add denormalized stat columns to products
-- ============================================================
DO $$ BEGIN
    ALTER TABLE products ADD COLUMN actual_rating numeric(3,1) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE products ADD COLUMN actual_review_count integer DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE products ADD COLUMN actual_booked_count integer DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ============================================================
-- 2. Live view for admin / verification (never stale)
-- ============================================================
CREATE OR REPLACE VIEW product_stats_live AS
SELECT
    p.id                                                        AS product_id,
    p.name                                                      AS product_name,
    p.business_unit_id,

    -- Rating: average of approved reviews only (NULL when none, shown as 0)
    COALESCE(
        ROUND(AVG(pr.rating) FILTER (WHERE pr.status = 'approved'), 1),
        0
    )::numeric(3,1)                                             AS actual_rating,

    -- Review count: approved only
    COUNT(pr.id) FILTER (WHERE pr.status = 'approved')          AS actual_review_count,

    -- Booked count: paid bookings, not cancelled
    COALESCE(bc.booked_count, 0)                                AS actual_booked_count,

    -- Comparison columns (denormalized cache, for drift detection)
    p.actual_rating                                             AS cached_rating,
    p.actual_review_count                                       AS cached_review_count,
    p.actual_booked_count                                       AS cached_booked_count

FROM products p
LEFT JOIN product_reviews pr ON pr.product_id = p.id
LEFT JOIN (
    SELECT
        product_id,
        COUNT(*) AS booked_count
    FROM bookings
    WHERE payment_status = 'paid'
      AND status <> 'cancelled'
    GROUP BY product_id
) bc ON bc.product_id = p.id
GROUP BY p.id, p.name, p.business_unit_id, bc.booked_count;

-- ============================================================
-- 3. Core refresh function: recalculate one product
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_product_stats(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rating        numeric(3,1);
    v_review_count  integer;
    v_booked_count  integer;
BEGIN

    -- Approved reviews: average rating + count
    SELECT
        COALESCE(ROUND(AVG(rating)::numeric, 1), 0),
        COUNT(*)
    INTO v_rating, v_review_count
    FROM product_reviews
    WHERE product_id    = p_product_id
      AND status        = 'approved';

    -- Paid, non-cancelled bookings
    SELECT COUNT(*)
    INTO v_booked_count
    FROM bookings
    WHERE product_id       = p_product_id
      AND payment_status   = 'paid'
      AND status          <> 'cancelled';

    -- Write back to products row
    UPDATE products
    SET
        actual_rating       = v_rating,
        actual_review_count = v_review_count,
        actual_booked_count = v_booked_count
    WHERE id = p_product_id;

END;
$$;

-- Allow anon/authenticated roles to call it (triggers run as SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION refresh_product_stats(uuid) TO anon, authenticated;

-- ============================================================
-- 4. Bulk refresh: recalculate every product (run after imports)
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_all_product_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM products LOOP
        PERFORM refresh_product_stats(r.id);
    END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_all_product_stats() TO authenticated;

-- ============================================================
-- 5. Trigger function: called by both reviews & bookings triggers
-- ============================================================
CREATE OR REPLACE FUNCTION trg_refresh_product_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product_id uuid;
BEGIN
    -- For DELETE we use OLD, for INSERT/UPDATE we use NEW
    IF TG_OP = 'DELETE' THEN
        v_product_id := OLD.product_id;
    ELSE
        v_product_id := NEW.product_id;
        -- Also refresh the old product if product_id changed (edge case)
        IF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
            PERFORM refresh_product_stats(OLD.product_id);
        END IF;
    END IF;

    -- Only trigger if we actually have a product_id to refresh
    IF v_product_id IS NOT NULL THEN
        PERFORM refresh_product_stats(v_product_id);
    END IF;

    -- Triggers on row-level must return the row
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- ============================================================
-- 6. Attach triggers to product_reviews
--    Fire on: INSERT, UPDATE (status/rating change), DELETE
-- ============================================================
DROP TRIGGER IF EXISTS trg_reviews_stats ON product_reviews;
CREATE TRIGGER trg_reviews_stats
    AFTER INSERT OR UPDATE OF status, rating OR DELETE
    ON product_reviews
    FOR EACH ROW
    EXECUTE FUNCTION trg_refresh_product_stats();

-- ============================================================
-- 7. Attach triggers to bookings
--    Fire on: INSERT, UPDATE (payment_status/status change), DELETE
-- ============================================================
DROP TRIGGER IF EXISTS trg_bookings_stats ON bookings;
CREATE TRIGGER trg_bookings_stats
    AFTER INSERT OR UPDATE OF payment_status, status OR DELETE
    ON bookings
    FOR EACH ROW
    EXECUTE FUNCTION trg_refresh_product_stats();

-- ============================================================
-- 8. Initial backfill: populate stats for all existing products
-- ============================================================
SELECT refresh_all_product_stats();

-- ============================================================
-- 9. Indexes to make the trigger function fast
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_reviews_product_approved
    ON product_reviews(product_id)
    WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_bookings_product_paid
    ON bookings(product_id)
    WHERE payment_status = 'paid' AND status <> 'cancelled';

-- ============================================================
-- Verification query (run manually after migration to confirm)
-- ============================================================
-- SELECT product_id, product_name, actual_rating, actual_review_count,
--        actual_booked_count, cached_rating, cached_review_count, cached_booked_count
-- FROM product_stats_live
-- ORDER BY actual_review_count DESC;
