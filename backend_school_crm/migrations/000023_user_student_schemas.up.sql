-- P4.1 / P4.2: Create schema views for user_service and student_service.
-- These are Strangler Fig bridge views — the new services read/write via the
-- same public tables as the monolith, accessed through schema-qualified names.
-- When the monolith is decommissioned (P5.5), the public tables are moved into
-- their respective schemas and these views are dropped.

-- ── user schema ───────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS "user";

CREATE OR REPLACE VIEW "user".users        AS SELECT * FROM public.users;
CREATE OR REPLACE VIEW "user".permissions  AS SELECT * FROM public.permissions;
CREATE OR REPLACE VIEW "user".branches     AS SELECT * FROM public.branches;

-- Optional tables — created only when they exist in the public schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='settings') THEN
    EXECUTE 'CREATE OR REPLACE VIEW "user".settings AS SELECT * FROM public.settings';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='financial_months') THEN
    EXECUTE 'CREATE OR REPLACE VIEW "user".financial_months AS SELECT * FROM public.financial_months';
  END IF;
END$$;

GRANT USAGE  ON SCHEMA "user"               TO CURRENT_USER;
GRANT SELECT ON ALL TABLES IN SCHEMA "user" TO CURRENT_USER;

-- ── student schema ────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS student;

CREATE OR REPLACE VIEW student.students   AS SELECT * FROM public.students;
CREATE OR REPLACE VIEW student.classes    AS SELECT * FROM public.classes;
CREATE OR REPLACE VIEW student.attendance AS SELECT * FROM public.attendance;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='student_notes') THEN
    EXECUTE 'CREATE OR REPLACE VIEW student.student_notes AS SELECT * FROM public.student_notes';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contact_logs') THEN
    EXECUTE 'CREATE OR REPLACE VIEW student.contact_logs AS SELECT * FROM public.contact_logs';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schedule_slots') THEN
    EXECUTE 'CREATE OR REPLACE VIEW student.schedule_slots AS SELECT * FROM public.schedule_slots';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='assignments') THEN
    EXECUTE 'CREATE OR REPLACE VIEW student.assignments AS SELECT * FROM public.assignments';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='assignment_submissions') THEN
    EXECUTE 'CREATE OR REPLACE VIEW student.assignment_submissions AS SELECT * FROM public.assignment_submissions';
  END IF;
END$$;

GRANT USAGE  ON SCHEMA student               TO CURRENT_USER;
GRANT SELECT ON ALL TABLES IN SCHEMA student TO CURRENT_USER;
