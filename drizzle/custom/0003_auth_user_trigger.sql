-- Auto-create accounts + users rows when a new Supabase Auth user signs up.
-- Fires on INSERT to auth.users (Supabase internal schema).
-- SECURITY DEFINER runs as the function owner (postgres), which has access to
-- the public schema even though the trigger fires in the auth schema.
--
-- This replaces the need for an explicit POST /api/auth/onboard call.
-- The account is always present before the user's first request reaches the app.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_account_id uuid;
  base_slug      text;
  final_slug     text;
  slug_suffix    int := 0;
BEGIN
  -- Derive a URL-safe slug from the local part of the email.
  base_slug := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]', '-', 'g'))
               || '-' || substr(replace(NEW.id::text, '-', ''), 1, 6);
  final_slug := base_slug;

  -- Ensure uniqueness with a numeric suffix if needed (rare but possible).
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM accounts WHERE forwarding_email_slug = final_slug
    );
    slug_suffix := slug_suffix + 1;
    final_slug  := base_slug || '-' || slug_suffix;
  END LOOP;

  -- Create the tenant account.
  -- company_name can be passed as user metadata during signup; fallback to email prefix.
  INSERT INTO accounts (name, forwarding_email_slug)
  VALUES (
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    final_slug
  )
  RETURNING id INTO new_account_id;

  -- Create the application user (id matches auth.users.id).
  INSERT INTO users (id, account_id, email, role)
  VALUES (NEW.id, new_account_id, NEW.email, 'owner');

  RETURN NEW;
END;
$$;

-- Idempotent: drop and recreate.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
