-- Migration 010: Force password change on first login
-- Supports admin-created accounts with temporary passwords

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
