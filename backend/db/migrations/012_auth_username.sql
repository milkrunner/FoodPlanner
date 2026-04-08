-- Convert auth from email to username
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);

-- Migrate existing data: use email prefix as username
UPDATE users SET username = SPLIT_PART(email, '@', 1) WHERE username IS NULL;

-- Make username required and unique
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username);

-- Email becomes optional (keep for backwards compatibility but no longer required for login)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
