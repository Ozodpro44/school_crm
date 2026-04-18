-- P5.1 / P5.2 / P5.3: Schema views for teacher, finance, and notification services.

-- ── teacher schema ─────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS teacher;
CREATE OR REPLACE VIEW teacher.teachers AS SELECT * FROM public.teachers;
CREATE OR REPLACE VIEW teacher.salaries AS SELECT * FROM public.salaries;
GRANT USAGE  ON SCHEMA teacher               TO school_user;
GRANT SELECT ON ALL TABLES IN SCHEMA teacher TO school_user;

-- ── finance schema ─────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS finance;
CREATE OR REPLACE VIEW finance.expenses        AS SELECT * FROM public.expenses;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='incomes') THEN
    EXECUTE 'CREATE OR REPLACE VIEW finance.incomes AS SELECT * FROM public.incomes';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='expense_budgets') THEN
    EXECUTE 'CREATE OR REPLACE VIEW finance.expense_budgets AS SELECT * FROM public.expense_budgets';
  END IF;
END$$;

GRANT USAGE  ON SCHEMA finance               TO school_user;
GRANT SELECT ON ALL TABLES IN SCHEMA finance TO school_user;

-- ── notification schema ────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS notification;
CREATE OR REPLACE VIEW notification.notifications AS SELECT * FROM public.notifications;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='message_logs') THEN
    EXECUTE 'CREATE OR REPLACE VIEW notification.message_logs AS SELECT * FROM public.message_logs';
  END IF;
END$$;

GRANT USAGE  ON SCHEMA notification               TO school_user;
GRANT SELECT ON ALL TABLES IN SCHEMA notification TO school_user;
