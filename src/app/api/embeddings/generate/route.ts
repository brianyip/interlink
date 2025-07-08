import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { 
  generateEmbeddingsBatch,
  validateTextsForBatch,
  validateOpenAIConfig,
  type EmbeddingBatchResult,
  type BatchProgress
} from '@/lib/embedding-service'

/**
 * POST /api/embeddings/generate
 * 
 * Generate embeddings for an array of text inputs using batch processing
 * Supports progress tracking and comprehensive error handling
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

    // Validate OpenAI configuration
    try {
      validateOpenAIConfig()
    } catch (configError) {
      return NextResponse.json({
        error: 'OpenAI configuration incomplete',
        details: configError instanceof Error ? configError.message : 'Unknown configuration error'
      }, { status: 500 })
    }

    // Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({
        error: 'Invalid JSON in request body',
        details: 'Request body must be valid JSON'
      }, { status: 400 })
    }

    const {
      texts,
      batchSize,
      model,
      dimensions,
      maxRetries,
      estimateOnly = false
    } = body

    // Validate input texts
    if (!texts || !Array.isArray(texts)) {
      return NextResponse.json({
        error: 'Invalid input',
        details: 'Request body must include "texts" array'
      }, { status: 400 })
    }

    if (texts.length === 0) {
      return NextResponse.json({
        error: 'Empty input',
        details: 'Texts array cannot be empty'
      }, { status: 400 })
    }

    // Validate texts and get cost estimate
    const validation = validateTextsForBatch(texts)
    
    if (!validation.isValid) {
      return NextResponse.json({
        error: 'Invalid text inputs',
        details: 'No valid texts found for processing',
        validation: {
          totalTexts: texts.length,
          validTexts: validation.validTexts,
          emptyTexts: validation.emptyTexts,
          oversizedTexts: validation.oversizedTexts,
          warnings: validation.warnings
        }
      }, { status: 400 })
    }

    // Return estimate if requested
    if (estimateOnly) {
      return NextResponse.json({
        estimate: {
          totalTexts: texts.length,
          validTexts: validation.validTexts,
          estimatedBatches: validation.estimatedBatches,
          estimatedTokens: validation.totalEstimatedTokens,
          estimatedCost: validation.estimatedCost,
          warnings: validation.warnings
        },
        pricing: {
          model: model || 'text-embedding-3-small',
          costPerToken: 0.00000002,
          costPer1KTokens: 0.00002
        }
      })
    }

    // Check if cost is reasonable (prevent accidental high-cost operations)
    if (validation.estimatedCost > 10.0) {
      return NextResponse.json({
        error: 'Cost too high',
        details: `Estimated cost $${validation.estimatedCost.toFixed(2)} exceeds $10.00 limit`,
        suggestion: 'Use estimateOnly=true to review costs first, or process in smaller batches',
        estimate: {
          estimatedCost: validation.estimatedCost,
          estimatedTokens: validation.totalEstimatedTokens,
          validTexts: validation.validTexts
        }
      }, { status: 400 })
    }

    console.log(`Starting embedding generation for user ${session.user.id}: ${validation.validTexts} texts, estimated cost $${validation.estimatedCost.toFixed(4)}`)

    // Track progress for logging (in production, could use WebSockets or SSE)
    const progressHistory: BatchProgress[] = []
    
    const options = {
      batchSize,
      model,
      dimensions,
      maxRetries,
      onProgress: (progress: BatchProgress) => {
        progressHistory.push({ ...progress })
        console.log(`Embedding progress: ${progress.processedTexts}/${progress.totalTexts} texts, batch ${progress.currentBatch}/${progress.totalBatches}`)
      }
    }

    // Generate embeddings
    const result: EmbeddingBatchResult = await generateEmbeddingsBatch(texts, options)
    
    console.log(`Embedding generation completed for user ${session.user.id}: ${result.embeddings.length}/${validation.validTexts} successful, cost $${result.totalCost.toFixed(6)}`)

    // Return comprehensive results
    return NextResponse.json({
      success: true,
      message: `Generated ${result.embeddings.length} embeddings successfully`,
      result: {
        totalInputs: texts.length,
        successfulEmbeddings: result.embeddings.length,
        failedEmbeddings: result.failures.length,
        successRate: result.successRate,
        totalCost: result.totalCost,
        totalTokens: result.totalTokens,
        processingTime: result.processingTime,
        batchesProcessed: result.batchesProcessed
      },
      embeddings: result.embeddings.map(emb => ({
        index: emb.index,
        text: emb.text.substring(0, 100) + (emb.text.length > 100 ? '...' : ''), // Truncate for response size
        dimensions: emb.embedding.length,
        tokens: emb.tokens,
        cost: emb.cost,
        embedding: emb.embedding
      })),
      failures: result.failures.length > 0 ? result.failures.map(failure => ({
        index: failure.index,
        text: failure.text.substring(0, 100) + (failure.text.length > 100 ? '...' : ''),
        error: failure.error,
        retryCount: failure.retryCount
      })) : undefined,
      metadata: {
        userId: session.user.id,
        model: model || 'text-embedding-3-small',
        dimensions: dimensions || 1536,
        batchSize: batchSize || 100,
        generatedAt: new Date().toISOString(),
        processingDuration: `${result.processingTime}ms`
      }
    })

  } catch (error) {
    console.error('Embedding generation failed:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Embedding generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/embeddings/generate
 * 
 * Get information about the embedding generation service
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

    // Validate OpenAI configuration
    try {
      validateOpenAIConfig()
    } catch (configError) {
      return NextResponse.json({
        error: 'OpenAI configuration incomplete',
        details: configError instanceof Error ? configError.message : 'Unknown configuration error',
        configured: false
      }, { status: 500 })
    }

    return NextResponse.json({
      status: 'ready',
      service: 'embedding-generation',
      capabilities: {
        batchProcessing: true,
        maxBatchSize: 100,
        progressTracking: true,
        costEstimation: true,
        retryLogic: true,
        models: ['text-embedding-3-small', 'text-embedding-3-large'],
        maxTokensPerText: 8191
      },
      pricing: {
        model: 'text-embedding-3-small',
        dimensions: 1536,
        costPerToken: 0.00000002,
        costPer1KTokens: 0.00002,
        currency: 'USD'
      },
      limits: {
        maxTextsPerRequest: 10000,
        maxCostPerRequest: 10.0,
        maxTokensPerText: 8191
      },
      usage: {
        endpoint: '/api/embeddings/generate',
        method: 'POST',
        contentType: 'application/json',
        bodySchema: {
          texts: 'string[] (required)',
          batchSize: 'number (optional, default: 100)',
          model: 'string (optional, default: text-embedding-3-small)',
          dimensions: 'number (optional, default: 1536)',
          maxRetries: 'number (optional, default: 3)',
          estimateOnly: 'boolean (optional, default: false)'
        }
      }
    })

  } catch (error) {
    console.error('Embedding service info failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to get embedding service information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}