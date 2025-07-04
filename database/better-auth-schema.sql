-- Better Auth + Interlink Complete Database Schema
-- Manual implementation to bypass CLI connection issues
-- Based on official Better Auth documentation

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS links CASCADE;
DROP TABLE IF EXISTS verification CASCADE;
DROP TABLE IF EXISTS account CASCADE;
DROP TABLE IF EXISTS session CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================================================
-- BETTER AUTH CORE TABLES (Official Schema)
-- =============================================================================

-- 1. USER TABLE (Core Authentication)
CREATE TABLE "user" (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified BOOLEAN NOT NULL DEFAULT FALSE,
    image TEXT,
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. SESSION TABLE (Session Management)  
CREATE TABLE session (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, -- Session ID
    token TEXT UNIQUE NOT NULL, -- The actual session token (used in cookies)
    userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    expiresAt TIMESTAMPTZ NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ACCOUNT TABLE (Authentication Providers)
CREATE TABLE account (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    password TEXT, -- For email/password authentication
    accessToken TEXT,
    refreshToken TEXT,
    accessTokenExpiresAt TIMESTAMPTZ,
    refreshTokenExpiresAt TIMESTAMPTZ,
    scope TEXT,
    idToken TEXT,
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. VERIFICATION TABLE (Email Verification)
CREATE TABLE verification (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt TIMESTAMPTZ NOT NULL,
    createdAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INTERLINK LINKS TABLE (Updated for Better Auth Integration)
-- =============================================================================

-- 5. LINKS TABLE (Updated to use TEXT userId for Better Auth compatibility)
CREATE TABLE links (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    displayName TEXT NOT NULL,
    url TEXT,
    status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    createdAt TIMESTAMPTZ DEFAULT NOW(),
    updatedAt TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure key is unique per user
    UNIQUE(userId, key)
);

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =============================================================================

-- User table trigger
CREATE TRIGGER update_user_updated_at 
    BEFORE UPDATE ON "user" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Session table trigger
CREATE TRIGGER update_session_updated_at 
    BEFORE UPDATE ON session 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Account table trigger
CREATE TRIGGER update_account_updated_at 
    BEFORE UPDATE ON account 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Verification table trigger
CREATE TRIGGER update_verification_updated_at 
    BEFORE UPDATE ON verification 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Links table trigger
CREATE TRIGGER update_links_updated_at 
    BEFORE UPDATE ON links 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PERFORMANCE INDEXES (Based on Better Auth Recommendations)
-- =============================================================================

-- User table indexes
CREATE INDEX idx_user_email ON "user"(email);

-- Session table indexes
CREATE INDEX idx_session_user_id ON session(userId);
CREATE INDEX idx_session_expires_at ON session(expiresAt);
CREATE INDEX idx_session_token ON session(token);

-- Account table indexes  
CREATE INDEX idx_account_user_id ON account(userId);
CREATE INDEX idx_account_provider_id ON account(providerId);

-- Verification table indexes
CREATE INDEX idx_verification_identifier ON verification(identifier);
CREATE INDEX idx_verification_expires_at ON verification(expiresAt);

-- Links table indexes (updated for camelCase)
CREATE INDEX idx_links_user_id ON links(userId);
CREATE INDEX idx_links_status ON links(status);
CREATE INDEX idx_links_key ON links(key);

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE "user" IS 'Better Auth core user table - stores user authentication data';
COMMENT ON TABLE session IS 'Better Auth session table - manages user sessions with tokens';
COMMENT ON TABLE account IS 'Better Auth account table - stores auth provider data (email/password, OAuth, etc.)';
COMMENT ON TABLE verification IS 'Better Auth verification table - handles email verification tokens';
COMMENT ON TABLE links IS 'Interlink links table - user-scoped link metadata for content replacement';

COMMENT ON COLUMN session.id IS 'Session ID - unique identifier for session record';
COMMENT ON COLUMN session.token IS 'Session token - used as session cookie value';
COMMENT ON COLUMN account.providerId IS 'Auth provider ID: "credential" for email/password, "google" for Google OAuth, etc.';
COMMENT ON COLUMN links.userId IS 'References Better Auth user.id - ensures user-scoped access to links';