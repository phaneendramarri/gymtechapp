-- Migration 0002: Add platform_settings table for Super-Admin global gateway configurations
-- Stores platform-wide SMTP relay credentials, SMS gateways, and WhatsApp Business API settings.

CREATE TABLE IF NOT EXISTS platform_settings (
    key         TEXT PRIMARY KEY,
    value_json  TEXT NOT NULL,
    updated_at  INTEGER NOT NULL
);
