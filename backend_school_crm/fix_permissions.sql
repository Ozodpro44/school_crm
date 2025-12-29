-- Fix permissions for branch_managers table
ALTER TABLE branch_managers OWNER TO school_user;

-- Grant permissions on all tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO school_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO school_user;
GRANT USAGE ON SCHEMA public TO school_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO school_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO school_user;
