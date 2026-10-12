#!/bin/bash

# Grant permissions to school_user on all tables
sudo -u postgres psql -d school_crm -c "
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO school_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO school_user;
GRANT USAGE ON SCHEMA public TO school_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO school_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO school_user;
"

echo "Permissions granted successfully"
