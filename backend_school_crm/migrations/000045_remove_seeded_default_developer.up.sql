-- Migration 000002 seeded a well-known developer account (dev@school.ru /
-- dev123456). Remove it, but ONLY while its password is still the seeded
-- bcrypt hash — if someone already rotated the password, leave it alone.
DELETE FROM developer_sessions
WHERE developer_id IN (
    SELECT id FROM developers
    WHERE email = 'dev@school.ru'
      AND password = '$2a$10$suOk3VhZTGLtj4QSjxsn3ef0Tr9o/y2kcAsobDQ2o0oikOPYfOGRW'
);

DELETE FROM developers
WHERE email = 'dev@school.ru'
  AND password = '$2a$10$suOk3VhZTGLtj4QSjxsn3ef0Tr9o/y2kcAsobDQ2o0oikOPYfOGRW';
