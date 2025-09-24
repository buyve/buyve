-- Performance optimization indexes migration
-- Run this on existing database to add performance indexes

-- Add index for chat_rooms token_address lookups
CREATE INDEX IF NOT EXISTS idx_chat_rooms_token_address ON chat_rooms(token_address);

-- Rename existing timestamp index for consistency (if needed)
DROP INDEX IF EXISTS idx_timestamp_desc;
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON token_price_history(timestamp_1min DESC);