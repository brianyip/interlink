import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Health check endpoint for Content Chat database setup
 * Verifies that all Content Chat tables and indexes exist
 */
export async function GET() {
  try {
    // Check if pgvector extension is available
    const vectorCheck = await db.query(`
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as has_vector
    `)

    // Check if all Content Chat tables exist
    const tablesCheck = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE table_name = 'webflow_connections') as webflow_connections,
        COUNT(*) FILTER (WHERE table_name = 'webflow_content') as webflow_content,
        COUNT(*) FILTER (WHERE table_name = 'content_chunks') as content_chunks,
        COUNT(*) FILTER (WHERE table_name = 'chat_conversations') as chat_conversations,
        COUNT(*) FILTER (WHERE table_name = 'chat_messages') as chat_messages,
        COUNT(*) FILTER (WHERE table_name = 'content_operations') as content_operations
      FROM information_schema.tables 
      WHERE table_schema = 'public'
        AND table_name IN (
          'webflow_connections', 
          'webflow_content', 
          'content_chunks', 
          'chat_conversations', 
          'chat_messages', 
          'content_operations'
        )
    `)

    // Check if HNSW index exists
    const indexCheck = await db.query(`
      SELECT EXISTS(
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_content_chunks_vector'
          AND tablename = 'content_chunks'
      ) as has_vector_index
    `)

    // Check if hybrid search function exists
    const functionCheck = await db.query(`
      SELECT EXISTS(
        SELECT 1 FROM pg_proc 
        WHERE proname = 'hybrid_search'
      ) as has_hybrid_search
    `)

    const tables = tablesCheck.rows[0]
    const hasVector = vectorCheck.rows[0].has_vector
    const hasVectorIndex = indexCheck.rows[0].has_vector_index
    const hasHybridSearch = functionCheck.rows[0].has_hybrid_search

    // All tables should exist (count = 1 each)
    const allTablesExist = Object.values(tables).every(count => count === 1)
    
    const isHealthy = hasVector && allTablesExist && hasVectorIndex && hasHybridSearch

    const status = isHealthy ? 'healthy' : 'unhealthy'
    const statusCode = isHealthy ? 200 : 503

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      checks: {
        pgvector_extension: hasVector,
        content_chat_tables: allTablesExist,
        vector_index: hasVectorIndex,
        hybrid_search_function: hasHybridSearch
      },
      details: {
        tables: {
          webflow_connections: tables.webflow_connections === 1,
          webflow_content: tables.webflow_content === 1,
          content_chunks: tables.content_chunks === 1,
          chat_conversations: tables.chat_conversations === 1,
          chat_messages: tables.chat_messages === 1,
          content_operations: tables.content_operations === 1
        }
      }
    }, { status: statusCode })

  } catch (error) {
    console.error('Content Chat health check failed:', error)
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: {
        pgvector_extension: false,
        content_chat_tables: false,
        vector_index: false,
        hybrid_search_function: false
      }
    }, { status: 503 })
  }
}