-- ============================================================
-- PHASE Z.2: Force Confirm Supabase Authenticated Email
-- Bypass email verification so kay@thenextperience.com can login immediately
-- ============================================================

UPDATE auth.users 
SET email_confirmed_at = now() 
WHERE email = 'kay@thenextperience.com';
