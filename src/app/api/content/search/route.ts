import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/database'
import { generateEmbedding } from '@/lib/embedding-service'
import type { 
  ContentSearchRequest, 
  ContentSearchResponse,
  ContentSearchResult
} from '@/lib/types'

/**
 * POST /api/content/search
 * 
 * Perform semantic and hybrid search across user's Webflow content
 * Uses the existing hybrid_search PostgreSQL function with pgvector
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication with Better Auth
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse and validate request body
    const body: ContentSearchRequest = await request.json()
    
    if (!body.query || typeof body.query !== 'string' || body.query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const query = body.query.trim()
    const {
      collectionId,
      dateRange,
      limit = 10,
      threshold = 0.7
    } = body.filters || {}

    // Validate limit parameter
    if (limit && (limit < 1 || limit > 100)) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      )
    }

    // Validate threshold parameter
    if (threshold && (threshold < 0 || threshold > 1)) {
      return NextResponse.json(
        { error: 'Threshold must be between 0 and 1' },
        { status: 400 }
      )
    }

    console.log(`Content search for user ${session.user.id}: "${query}" (limit: ${limit}, threshold: ${threshold})`)

    const startTime = Date.now()

    // Generate embedding for search query
    let queryEmbedding: number[]
    try {
      const embeddingResult = await generateEmbedding(query)
      queryEmbedding = embeddingResult.embedding
    } catch (embeddingError) {
      console.error('Failed to generate query embedding:', embeddingError)
      return NextResponse.json(
        { 
          error: 'Failed to generate search embedding',
          details: embeddingError instanceof Error ? embeddingError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }

    // Build search parameters
    const searchParams = [
      JSON.stringify(queryEmbedding), // query_embedding as JSON string for PostgreSQL
      query, // query_text for trigram search
      session.user.id, // user_id for data isolation
      limit, // match_limit
      threshold // similarity_threshold
    ]

    // Build the search query - use the existing hybrid_search function
    let searchQuery = `
      SELECT 
        chunk_id,
        content_id, 
        content,
        title,
        slug,
        similarity,
        rank
      FROM hybrid_search($1::vector(1536), $2, $3, $4, $5)
    `
    
    // Add optional filters
    const additionalFilters: string[] = []
    const additionalParams: unknown[] = []
    let paramIndex = 6

    if (collectionId) {
      additionalFilters.push(`wc.collectionId = $${paramIndex}`)
      additionalParams.push(collectionId)
      paramIndex++
    }

    if (dateRange?.start || dateRange?.end) {
      if (dateRange.start) {
        additionalFilters.push(`wc.lastPublished >= $${paramIndex}`)
        additionalParams.push(dateRange.start)
        paramIndex++
      }
      if (dateRange.end) {
        additionalFilters.push(`wc.lastPublished <= $${paramIndex}`)
        additionalParams.push(dateRange.end)
        paramIndex++
      }
    }

    // If we have additional filters, we need to join with webflow_content table
    if (additionalFilters.length > 0) {
      searchQuery = `
        WITH search_results AS (
          SELECT 
            chunk_id,
            content_id, 
            content,
            title,
            slug,
            similarity,
            rank
          FROM hybrid_search($1::vector(1536), $2, $3, $4, $5)
        )
        SELECT sr.*
        FROM search_results sr
        JOIN webflow_content wc ON sr.content_id = wc.id
        WHERE ${additionalFilters.join(' AND ')}
        ORDER BY sr.rank DESC
      `
    }

    // Execute search query
    const searchResult = await db.query(searchQuery, [...searchParams, ...additionalParams])

    const executionTime = Date.now() - startTime

    // Map database results to response format
    const results: ContentSearchResult[] = searchResult.rows.map(row => ({
      chunkId: row.chunk_id,
      contentId: row.content_id,
      content: row.content,
      title: row.title,
      slug: row.slug,
      similarity: parseFloat(row.similarity),
      rank: parseFloat(row.rank)
    }))

    const response: ContentSearchResponse = {
      results,
      totalCount: results.length,
      query,
      executionTime
    }

    console.log(`Search completed: ${results.length} results in ${executionTime}ms`)

    return NextResponse.json(response)

  } catch (error) {
    console.error('Content search failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Content search failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/content/search
 * 
 * Get search capabilities and user's content statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication with Better Auth
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user's content statistics
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT wc.id) as total_content,
        COUNT(cc.id) as total_chunks,
        COUNT(DISTINCT wc.collectionId) as collections,
        COUNT(CASE WHEN cc.contentVector IS NOT NULL THEN 1 END) as embedded_chunks,
        MAX(wc.updatedAt) as last_updated
      FROM webflow_content wc
      LEFT JOIN content_chunks cc ON wc.id = cc.contentId
      WHERE wc.userId = $1
    `

    const statsResult = await db.query(statsQuery, [session.user.id])
    const stats = statsResult.rows[0]

    // Get available collections
    const collectionsQuery = `
      SELECT DISTINCT collectionId, collectionName, COUNT(*) as item_count
      FROM webflow_content 
      WHERE userId = $1
      GROUP BY collectionId, collectionName
      ORDER BY collectionName
    `

    const collectionsResult = await db.query(collectionsQuery, [session.user.id])
    const collections = collectionsResult.rows.map(row => ({
      id: row.collectionid,
      name: row.collectionname,
      itemCount: parseInt(row.item_count)
    }))

    return NextResponse.json({
      status: 'ready',
      capabilities: {
        semanticSearch: true,
        keywordSearch: true,
        hybridSearch: true,
        filtering: {
          byCollection: true,
          byDateRange: true,
          byRelevance: true
        }
      },
      statistics: {
        totalContent: parseInt(stats.total_content) || 0,
        totalChunks: parseInt(stats.total_chunks) || 0,
        embeddedChunks: parseInt(stats.embedded_chunks) || 0,
        collections: parseInt(stats.collections) || 0,
        lastUpdated: stats.last_updated,
        embeddingCoverage: stats.total_chunks > 0 
          ? Math.round((parseInt(stats.embedded_chunks) / parseInt(stats.total_chunks)) * 100)
          : 0
      },
      collections,
      limits: {
        maxResultsPerQuery: 100,
        minSimilarityThreshold: 0.1,
        maxSimilarityThreshold: 1.0,
        defaultLimit: 10,
        defaultThreshold: 0.7
      }
    })

  } catch (error) {
    console.error('Failed to get search status:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to get search status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}