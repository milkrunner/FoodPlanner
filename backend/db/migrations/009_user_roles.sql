-- Migration 009: User roles and account status
-- Adds role-based access control and account activation

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Make the oldest user an admin automatically
UPDATE users SET role = 'admin'
WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
  AND role = 'user';
