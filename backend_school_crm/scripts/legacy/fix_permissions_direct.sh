#!/bin/bash

# This script needs to be run with postgres user access
# Grant all permissions directly

echo "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO school_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO school_user;
ALTER TABLE branch_managers OWNER TO school_user;
ALTER TABLE users OWNER TO school_user;
ALTER TABLE branches OWNER TO school_user;
ALTER TABLE students OWNER TO school_user;
ALTER TABLE classes OWNER TO school_user;
ALTER TABLE teachers OWNER TO school_user;
ALTER TABLE payments OWNER TO school_user;
ALTER TABLE salaries OWNER TO school_user;
ALTER TABLE expenses OWNER TO school_user;
ALTER TABLE incomes OWNER TO school_user;
ALTER TABLE settings OWNER TO school_user;
ALTER TABLE permissions OWNER TO school_user;
ALTER TABLE teacher_classes OWNER TO school_user;" | sudo -u postgres psql -d school_crm
