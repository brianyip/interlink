import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/database'
import { 
  testEmbeddingService,
  validateOpenAIConfig,
  EMBEDDING_CONFIG,
  EMBEDDING_PRICING
} from '@/lib/embedding-service'

/**
 * GET /api/embeddings/status
 * 
 * Get embedding service status, user statistics, and health information
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

    const userId = session.user.id

    // Test embedding service health
    const serviceHealth = await testEmbeddingService()

    // Get user's content and embedding statistics
    const userStats = await getUserEmbeddingStats(userId)

    // Get recent operations for this user
    const recentOperations = await getRecentEmbeddingOperations(userId)

    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      service: {
        health: serviceHealth.isWorking ? 'healthy' : 'unhealthy',
        model: serviceHealth.model,
        dimensions: serviceHealth.dimensions,
        testCost: serviceHealth.testCost,
        error: serviceHealth.error
      },
      user: {
        id: userId,
        statistics: userStats,
        recentOperations: recentOperations
      },
      configuration: {
        model: EMBEDDING_CONFIG.model,
        dimensions: EMBEDDING_CONFIG.dimensions,
        maxTokens: EMBEDDING_CONFIG.maxTokens,
        pricing: {
          costPerToken: EMBEDDING_PRICING.costPerToken,
          costPer1K: EMBEDDING_PRICING.costPer1K,
          currency: 'USD'
        }
      },
      endpoints: {
        generate: '/api/embeddings/generate',
        status: '/api/embeddings/status'
      }
    })

  } catch (error) {
    console.error('Embedding status check failed:', error)
    
    return NextResponse.json(
      { 
        status: 'error',
        error: 'Failed to get embedding status',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * Get embedding statistics for a specific user
 */
async function getUserEmbeddingStats(userId: string): Promise<{
  totalContentItems: number
  totalChunks: number
  chunksWithEmbeddings: number
  embeddingCoverage: number
  averageChunkSize: number
  totalEstimatedTokens: number
  oldestContent: string | null
  newestContent: string | null
}> {
  try {
    // Get content and chunk statistics
    const statsQuery = await db.query(`
      SELECT 
        COUNT(DISTINCT wc.id) as total_content_items,
        COUNT(cc.id) as total_chunks,
        COUNT(cc.contentVector) as chunks_with_embeddings,
        AVG(LENGTH(cc.content)) as avg_chunk_size,
        SUM(cc.tokens) as total_tokens,
        MIN(wc.createdAt) as oldest_content,
        MAX(wc.createdAt) as newest_content
      FROM webflow_content wc
      LEFT JOIN content_chunks cc ON wc.id = cc.contentId
      WHERE wc.userId = $1
    `, [userId])

    const stats = statsQuery.rows[0]
    const totalChunks = parseInt(stats.total_chunks || '0')
    const chunksWithEmbeddings = parseInt(stats.chunks_with_embeddings || '0')

    return {
      totalContentItems: parseInt(stats.total_content_items || '0'),
      totalChunks,
      chunksWithEmbeddings,
      embeddingCoverage: totalChunks > 0 
        ? Math.round((chunksWithEmbeddings / totalChunks) * 100) 
        : 0,
      averageChunkSize: Math.round(parseFloat(stats.avg_chunk_size || '0')),
      totalEstimatedTokens: parseInt(stats.total_tokens || '0'),
      oldestContent: stats.oldest_content || null,
      newestContent: stats.newest_content || null
    }
  } catch (error) {
    console.error('Failed to get user embedding stats:', error)
    return {
      totalContentItems: 0,
      totalChunks: 0,
      chunksWithEmbeddings: 0,
      embeddingCoverage: 0,
      averageChunkSize: 0,
      totalEstimatedTokens: 0,
      oldestContent: null,
      newestContent: null
    }
  }
}

/**
 * Get recent embedding-related operations for a user
 */
async function getRecentEmbeddingOperations(userId: string, limit = 10): Promise<Array<{
  id: string
  operationType: string
  status: string
  startedAt: string
  completedAt: string | null
  duration: number | null
  affectedItems: number
  error: string | null
}>> {
  try {
    const operationsQuery = await db.query(`
      SELECT 
        id,
        operationType,
        status,
        startedAt,
        completedAt,
        error,
        affectedItems,
        CASE 
          WHEN completedAt IS NOT NULL AND startedAt IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (completedAt - startedAt))::INTEGER * 1000
          ELSE NULL 
        END as duration_ms
      FROM content_operations
      WHERE userId = $1 
        AND operationType IN ('sync', 'embedding', 'bulk_update')
      ORDER BY startedAt DESC
      LIMIT $2
    `, [userId, limit])

    return operationsQuery.rows.map(row => ({
      id: row.id,
      operationType: row.operationtype,
      status: row.status,
      startedAt: row.startedat,
      completedAt: row.completedat,
      duration: row.duration_ms,
      affectedItems: Array.isArray(row.affecteditems) 
        ? row.affecteditems.length 
        : 0,
      error: row.error
    }))
  } catch (error) {
    console.error('Failed to get recent operations:', error)
    return []
  }
}

/**
 * POST /api/embeddings/status
 * 
 * Update embedding status or trigger embedding generation for existing content
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

    // Parse request body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({
        error: 'Invalid JSON in request body'
      }, { status: 400 })
    }

    const { action } = body
    // contentIds could be used for selective operations in the future

    if (!action) {
      return NextResponse.json({
        error: 'Action is required',
        validActions: ['generate_missing_embeddings', 'refresh_embeddings', 'health_check']
      }, { status: 400 })
    }

    const userId = session.user.id

    switch (action) {
      case 'health_check':
        // Perform comprehensive health check
        const healthResult = await performHealthCheck(userId)
        return NextResponse.json({
          success: true,
          action: 'health_check',
          result: healthResult,
          timestamp: new Date().toISOString()
        })

      case 'generate_missing_embeddings':
        // Find content chunks without embeddings and estimate generation
        const missingEmbeddings = await findMissingEmbeddings(userId)
        return NextResponse.json({
          success: true,
          action: 'generate_missing_embeddings',
          result: {
            chunksWithoutEmbeddings: missingEmbeddings.count,
            estimatedCost: missingEmbeddings.estimatedCost,
            estimatedTokens: missingEmbeddings.estimatedTokens,
            recommendation: missingEmbeddings.count > 0 
              ? 'Use /api/embeddings/generate endpoint to process these chunks'
              : 'All chunks already have embeddings'
          },
          timestamp: new Date().toISOString()
        })

      case 'refresh_embeddings':
        // Provide information about refreshing embeddings
        return NextResponse.json({
          success: true,
          action: 'refresh_embeddings',
          result: {
            message: 'To refresh embeddings, first clear existing vectors then regenerate',
            steps: [
              '1. Clear existing embeddings (if needed)',
              '2. Use /api/embeddings/generate to recreate embeddings',
              '3. Update vector search indexes'
            ],
            warning: 'Refreshing embeddings will incur new API costs'
          },
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json({
          error: 'Unknown action',
          validActions: ['generate_missing_embeddings', 'refresh_embeddings', 'health_check']
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Embedding status operation failed:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Status operation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * Perform comprehensive health check for embedding system
 */
async function performHealthCheck(userId: string): Promise<{
  database: boolean
  openai: boolean
  contentAvailable: boolean
  embeddingService: boolean
  issues: string[]
}> {
  const issues: string[] = []
  let database = false
  let openai = false
  let contentAvailable = false
  let embeddingService = false

  // Test database connectivity
  try {
    await db.query('SELECT 1')
    database = true
  } catch {
    database = false
    issues.push('Database connectivity failed')
  }

  // Test OpenAI configuration and service
  try {
    validateOpenAIConfig()
    const serviceTest = await testEmbeddingService()
    openai = serviceTest.isWorking
    embeddingService = serviceTest.isWorking

    if (!serviceTest.isWorking && serviceTest.error) {
      issues.push(`OpenAI service error: ${serviceTest.error}`)
    }
  } catch {
    openai = false
    embeddingService = false
    issues.push('OpenAI configuration invalid')
  }

  // Check if user has content available
  try {
    const contentCheck = await db.query(`
      SELECT COUNT(*) as count FROM webflow_content WHERE userId = $1
    `, [userId])
    
    contentAvailable = parseInt(contentCheck.rows[0].count) > 0
    if (!contentAvailable) {
      issues.push('No content available for embedding generation')
    }
  } catch {
    contentAvailable = false
    issues.push('Failed to check content availability')
  }

  return {
    database,
    openai,
    contentAvailable,
    embeddingService,
    issues
  }
}

/**
 * Find content chunks that don't have embeddings yet
 */
async function findMissingEmbeddings(userId: string): Promise<{
  count: number
  estimatedTokens: number
  estimatedCost: number
}> {
  try {
    const missingQuery = await db.query(`
      SELECT 
        COUNT(*) as missing_count,
        SUM(tokens) as total_tokens
      FROM content_chunks cc
      JOIN webflow_content wc ON cc.contentId = wc.id
      WHERE wc.userId = $1 
        AND cc.contentVector IS NULL
    `, [userId])

    const result = missingQuery.rows[0]
    const count = parseInt(result.missing_count || '0')
    const totalTokens = parseInt(result.total_tokens || '0')
    const estimatedCost = totalTokens * EMBEDDING_PRICING.costPerToken

    return {
      count,
      estimatedTokens: totalTokens,
      estimatedCost
    }
  } catch (error) {
    console.error('Failed to find missing embeddings:', error)
    return {
      count: 0,
      estimatedTokens: 0,
      estimatedCost: 0
    }
  }
}