-- Content Chat Database Schema Migration
-- Extends existing Better Auth + Interlink schema with Content Chat functionality
-- Uses pgvector with HNSW indexes for optimal performance

-- =============================================================================
-- ENABLE EXTENSIONS
-- =============================================================================

-- Enable pgvector extension for vector operations
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for text similarity searches (hybrid search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- WEBFLOW INTEGRATION TABLES
-- =============================================================================

-- Webflow OAuth connections (encrypted token storage)
CREATE TABLE webflow_connections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  accessToken TEXT NOT NULL, -- Encrypted with AES-256
  refreshToken TEXT NOT NULL, -- Encrypted with AES-256
  expiresAt TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(userId)
);

-- Webflow content metadata
CREATE TABLE webflow_content (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  collectionId TEXT NOT NULL,
  itemId TEXT NOT NULL,
  collectionName TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  lastPublished TIMESTAMPTZ,
  contentHash TEXT NOT NULL, -- SHA-256 for change detection
  metadata JSONB NOT NULL DEFAULT '{}', -- Extracted entities, authors, etc.
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(userId, collectionId, itemId)
);

-- =============================================================================
-- CONTENT PROCESSING & VECTOR STORAGE
-- =============================================================================

-- Content chunks with embeddings (OpenAI text-embedding-3-small: 1536 dimensions)
CREATE TABLE content_chunks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  contentId TEXT NOT NULL REFERENCES webflow_content(id) ON DELETE CASCADE,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  chunkIndex INTEGER NOT NULL,
  content TEXT NOT NULL,
  contentVector vector(1536), -- OpenAI text-embedding-3-small
  tokens INTEGER NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}', -- Extracted entities, keywords
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contentId, chunkIndex)
);

-- =============================================================================
-- CHAT SYSTEM TABLES
-- =============================================================================

-- Chat conversations
CREATE TABLE chat_conversations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title TEXT,
  metadata JSONB NOT NULL DEFAULT '{}', -- Conversation metadata
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages with function calls support
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  conversationId TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'function')),
  content TEXT,
  functionCall JSONB, -- OpenAI function calling data
  metadata JSONB NOT NULL DEFAULT '{}', -- Includes matches, token count, etc.
  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- AUDIT & OPERATIONS TABLES
-- =============================================================================

-- Content operations audit log
CREATE TABLE content_operations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  userId TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  operationType TEXT NOT NULL CHECK(operationType IN ('search', 'update', 'bulk_update', 'export', 'sync')),
  affectedItems JSONB NOT NULL DEFAULT '[]', -- Array of content IDs
  changes JSONB, -- Before/after for updates
  status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
  error TEXT,
  startedAt TIMESTAMPTZ DEFAULT NOW(),
  completedAt TIMESTAMPTZ
);

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =============================================================================

-- Webflow connections trigger
CREATE TRIGGER update_webflow_connections_updated_at 
    BEFORE UPDATE ON webflow_connections 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Webflow content trigger
CREATE TRIGGER update_webflow_content_updated_at 
    BEFORE UPDATE ON webflow_content 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Chat conversations trigger
CREATE TRIGGER update_chat_conversations_updated_at 
    BEFORE UPDATE ON chat_conversations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

-- Webflow connections indexes
CREATE INDEX idx_webflow_connections_user ON webflow_connections(userId);
CREATE INDEX idx_webflow_connections_expires ON webflow_connections(expiresAt);

-- Webflow content indexes
CREATE INDEX idx_webflow_content_user ON webflow_content(userId);
CREATE INDEX idx_webflow_content_collection ON webflow_content(userId, collectionId);
CREATE INDEX idx_webflow_content_updated ON webflow_content(updatedAt);
CREATE INDEX idx_webflow_content_hash ON webflow_content(contentHash);

-- Content chunks indexes
CREATE INDEX idx_content_chunks_content ON content_chunks(contentId);
CREATE INDEX idx_content_chunks_user ON content_chunks(userId);
CREATE INDEX idx_content_chunks_tokens ON content_chunks(tokens);

-- HNSW index for vector similarity search (optimized for 1536d vectors)
-- Using cosine distance with optimal parameters for performance
CREATE INDEX idx_content_chunks_vector ON content_chunks 
USING hnsw (contentVector vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

-- Text search indexes for hybrid search
CREATE INDEX idx_content_chunks_content_trgm ON content_chunks 
USING gin (content gin_trgm_ops);

-- Chat system indexes
CREATE INDEX idx_chat_conversations_user ON chat_conversations(userId);
CREATE INDEX idx_chat_conversations_updated ON chat_conversations(updatedAt);

CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversationId);
CREATE INDEX idx_chat_messages_created ON chat_messages(createdAt);
CREATE INDEX idx_chat_messages_role ON chat_messages(role);

-- Content operations indexes
CREATE INDEX idx_content_operations_user ON content_operations(userId);
CREATE INDEX idx_content_operations_type ON content_operations(operationType);
CREATE INDEX idx_content_operations_status ON content_operations(status);
CREATE INDEX idx_content_operations_started ON content_operations(startedAt);

-- =============================================================================
-- HYBRID SEARCH FUNCTION
-- =============================================================================

-- Hybrid search combining vector similarity and text matching
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(1536),
  query_text TEXT,
  user_id TEXT,
  match_limit INTEGER DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  chunk_id TEXT,
  content_id TEXT,
  content TEXT,
  title TEXT,
  slug TEXT,
  similarity FLOAT,
  rank FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH vector_search AS (
    SELECT 
      cc.id,
      cc.contentId,
      cc.content,
      wc.title,
      wc.slug,
      1 - (cc.contentVector <=> query_embedding) AS similarity
    FROM content_chunks cc
    JOIN webflow_content wc ON cc.contentId = wc.id
    WHERE cc.userId = user_id
      AND cc.contentVector IS NOT NULL
    ORDER BY cc.contentVector <=> query_embedding
    LIMIT match_limit * 3 -- Fetch more for re-ranking
  ),
  text_search AS (
    SELECT 
      cc.id,
      similarity(cc.content, query_text) AS text_similarity
    FROM content_chunks cc
    WHERE cc.userId = user_id
      AND cc.content % query_text -- Trigram similarity
  )
  SELECT 
    vs.id,
    vs.contentId,
    vs.content,
    vs.title,
    vs.slug,
    vs.similarity,
    -- Weighted combination: 70% vector similarity, 30% text similarity
    (vs.similarity * 0.7 + COALESCE(ts.text_similarity, 0) * 0.3) AS rank
  FROM vector_search vs
  LEFT JOIN text_search ts ON vs.id = ts.id
  WHERE vs.similarity > similarity_threshold
  ORDER BY rank DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PERFORMANCE OPTIMIZATION SETTINGS (for current session)
-- =============================================================================

-- Optimize HNSW search parameters for good recall/speed balance
SET hnsw.ef_search = 100;

-- Enable iterative scans for better recall with filtering
SET hnsw.iterative_scan = strict_order;

-- Optimize parallel workers for index builds and queries
SET max_parallel_maintenance_workers = 4;
SET max_parallel_workers_per_gather = 4;

-- =============================================================================
-- TABLE COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE webflow_connections IS 'Encrypted OAuth tokens for Webflow API access per user';
COMMENT ON TABLE webflow_content IS 'Metadata for Webflow CMS content items';
COMMENT ON TABLE content_chunks IS 'Processed content chunks with vector embeddings for semantic search';
COMMENT ON TABLE chat_conversations IS 'Chat conversation sessions for Content Chat feature';
COMMENT ON TABLE chat_messages IS 'Individual messages within chat conversations';
COMMENT ON TABLE content_operations IS 'Audit log for all content operations (search, update, sync)';

COMMENT ON COLUMN webflow_connections.accessToken IS 'AES-256 encrypted Webflow OAuth access token';
COMMENT ON COLUMN webflow_connections.refreshToken IS 'AES-256 encrypted Webflow OAuth refresh token';
COMMENT ON COLUMN webflow_content.contentHash IS 'SHA-256 hash for change detection and deduplication';
COMMENT ON COLUMN content_chunks.contentVector IS 'OpenAI text-embedding-3-small vector (1536 dimensions)';
COMMENT ON COLUMN content_chunks.tokens IS 'Token count for cost tracking and chunking optimization';
COMMENT ON COLUMN chat_messages.functionCall IS 'OpenAI function calling data for tool usage';

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Display success message
DO $$
BEGIN
  RAISE NOTICE 'Content Chat schema migration completed successfully!';
  RAISE NOTICE 'Created % tables with vector search capabilities', 6;
  RAISE NOTICE 'HNSW index created for 1536-dimensional vectors';
  RAISE NOTICE 'Hybrid search function ready for use';
END $$;