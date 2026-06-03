-- Custom migration: audit_log immutability trigger
-- Run ONCE after 0000_natural_ares.sql applies. Not tracked in Drizzle journal
-- because drizzle-kit does not generate trigger DDL.
-- This is the DB-layer enforcement of the append-only guarantee (SCHEMA.md).

-- Function: raise exception on any UPDATE or DELETE on audit_log.
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'audit_log is immutable — UPDATE and DELETE are not permitted (action: %)', TG_OP;
  RETURN NULL;
END;
$$;

-- Trigger: fires BEFORE UPDATE or DELETE, blocks both.
DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- Note: on Supabase, apply this in the SQL Editor (Database > SQL Editor) or via
-- supabase db push / supabase migrations run after adding to supabase/migrations/.
