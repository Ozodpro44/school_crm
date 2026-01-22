-- Create developers table for dev dashboard authentication
CREATE TABLE IF NOT EXISTS developers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'developer',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_developers_email ON developers(email);

-- Seed default developer user (password: dev123456)
-- The password is hashed using bcrypt
INSERT INTO developers (email, password, full_name, role, is_active, created_at, updated_at)
VALUES (
    'dev@school.ru',
    '$2a$10$suOk3VhZTGLtj4QSjxsn3ef0Tr9o/y2kcAsobDQ2o0oikOPYfOGRW', -- bcrypt hash of 'dev123456'
    'Developer',
    'developer',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO NOTHING;
