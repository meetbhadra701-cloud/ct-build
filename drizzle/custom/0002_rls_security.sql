-- Phase 7: Row-Level Security on all tenant tables.
--
-- Architecture: the application uses ONLY the service_role key for all DB
-- operations (Drizzle client). The service_role bypasses RLS by design.
-- Enabling RLS with no permissive policies means anon/authenticated clients
-- can never read tenant data even if a key is accidentally exposed.
--
-- Apply after: 0000_natural_ares.sql + 0001_audit_log_immutability.sql
-- Run in: Supabase Dashboard > SQL Editor, or via supabase db push

-- Enable RLS on every tenant-scoped table.
ALTER TABLE accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors               ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE extractions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_results    ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs                  ENABLE ROW LEVEL SECURITY;

-- No permissive policies are added here. This means:
--   anon key    → denied (all SELECT/INSERT/UPDATE/DELETE blocked)
--   authenticated role → denied
--   service_role → bypasses RLS (server operations work as normal)
--
-- If you later need realtime subscriptions or client-direct queries,
-- add scoped policies BEFORE enabling that access path.
