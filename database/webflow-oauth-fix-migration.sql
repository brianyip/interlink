-- Webflow OAuth Fix Migration
-- Removes refresh token dependency and adds proper Webflow timestamp handling
-- Based on ChatGPT insights: Webflow provides 365-day access tokens without refresh tokens

-- =============================================================================
-- WEBFLOW CONNECTIONS SCHEMA FIX
-- =============================================================================

-- Step 1: Make refreshToken nullable (Webflow doesn't provide refresh tokens)
ALTER TABLE webflow_connections 
ALTER COLUMN refreshToken DROP NOT NULL;

-- Step 2: Add tokenCreatedAt for Webflow's created_at timestamp
ALTER TABLE webflow_connections 
ADD COLUMN tokenCreatedAt TIMESTAMPTZ;

-- Step 3: Update existing data to handle the schema change
-- Set existing refreshToken to NULL for any existing connections
UPDATE webflow_connections 
SET refreshToken = NULL 
WHERE refreshToken = '' OR refreshToken IS NOT NULL;

-- Step 4: Add index for new tokenCreatedAt column
CREATE INDEX idx_webflow_connections_token_created ON webflow_connections(tokenCreatedAt);

-- Step 5: Update table comments to reflect new schema
COMMENT ON COLUMN webflow_connections.refreshToken IS 'NULL - Webflow uses 365-day access tokens without refresh tokens';
COMMENT ON COLUMN webflow_connections.tokenCreatedAt IS 'Webflow OAuth token creation timestamp from created_at field';
COMMENT ON COLUMN webflow_connections.expiresAt IS 'Calculated from tokenCreatedAt + expires_in (365 days for Webflow)';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Display current schema for verification
DO $$
DECLARE
    connection_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO connection_count FROM webflow_connections;
    
    RAISE NOTICE 'Webflow OAuth schema migration completed!';
    RAISE NOTICE 'refreshToken column is now nullable';
    RAISE NOTICE 'Added tokenCreatedAt column for Webflow timestamps';
    RAISE NOTICE 'Updated % existing connections', connection_count;
    RAISE NOTICE 'Schema now supports Webflow 365-day access tokens';
END $$;

-- Show updated table structure (use in psql client)
-- \d webflow_connections;