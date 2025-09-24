-- Migration: Change from 15-minute to 1-minute intervals for price history

-- 1. Create new table with 1-minute intervals
CREATE TABLE IF NOT EXISTS token_price_history_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_address VARCHAR(255) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    open_price DECIMAL(20, 8) NOT NULL,
    high_price DECIMAL(20, 8) NOT NULL,
    low_price DECIMAL(20, 8) NOT NULL,
    close_price DECIMAL(20, 8) NOT NULL,
    timestamp_1min TIMESTAMP WITH TIME ZONE NOT NULL,
    volume DECIMAL(20, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add indexes
CREATE INDEX idx_token_timestamp_new ON token_price_history_new (token_address, timestamp_1min);
CREATE INDEX idx_timestamp_desc_new ON token_price_history_new (timestamp_1min DESC);
CREATE UNIQUE INDEX unique_token_timestamp_new ON token_price_history_new (token_address, timestamp_1min);

-- 3. Drop old table
DROP TABLE IF EXISTS token_price_history;

-- 4. Rename new table
ALTER TABLE token_price_history_new RENAME TO token_price_history;

-- 5. Rename indexes
ALTER INDEX idx_token_timestamp_new RENAME TO idx_token_timestamp;
ALTER INDEX idx_timestamp_desc_new RENAME TO idx_timestamp_desc;
ALTER INDEX unique_token_timestamp_new RENAME TO token_price_history_token_address_timestamp_1min_key;

-- 6. Update cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_price_history()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM token_price_history 
    WHERE token_address = NEW.token_address 
    AND timestamp_1min NOT IN (
        SELECT timestamp_1min 
        FROM token_price_history 
        WHERE token_address = NEW.token_address 
        ORDER BY timestamp_1min DESC 
        LIMIT 60
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Recreate trigger
DROP TRIGGER IF EXISTS cleanup_price_history_trigger ON token_price_history;
CREATE TRIGGER cleanup_price_history_trigger
    AFTER INSERT ON token_price_history
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_old_price_history();

-- 8. Create or update 1-minute normalization function
CREATE OR REPLACE FUNCTION normalize_to_1min(input_timestamp TIMESTAMP WITH TIME ZONE)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN date_trunc('minute', input_timestamp);
END;
$$ LANGUAGE plpgsql;

-- 9. Drop old 15-minute normalization function if exists
DROP FUNCTION IF EXISTS normalize_to_15min(TIMESTAMP WITH TIME ZONE);