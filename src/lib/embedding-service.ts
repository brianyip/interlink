import OpenAI from 'openai'
import type { 
  EmbeddingRequest, 
  EmbeddingResponse 
} from './types'

// =============================================================================
// BATCH PROCESSING TYPES
// =============================================================================

/**
 * Progress tracking for batch embedding operations
 */
export interface BatchProgress {
  totalTexts: number
  processedTexts: number
  currentBatch: number
  totalBatches: number
  successfulEmbeddings: number
  failedEmbeddings: number
  totalCost: number
  totalTokens: number
  estimatedTimeRemaining?: number // in milliseconds
}

/**
 * Individual embedding result within a batch
 */
export interface EmbeddingResult {
  text: string
  embedding: number[]
  index: number // Original position in input array
  tokens: number
  cost: number
}

/**
 * Failed embedding attempt within a batch
 */
export interface EmbeddingFailure {
  text: string
  index: number // Original position in input array
  error: string
  retryCount: number
}

/**
 * Complete batch processing result
 */
export interface EmbeddingBatchResult {
  embeddings: EmbeddingResult[]
  failures: EmbeddingFailure[]
  totalCost: number
  totalTokens: number
  batchesProcessed: number
  processingTime: number // in milliseconds
  successRate: number // percentage of successful embeddings
}

/**
 * OpenAI Embedding Service for Content Chat
 * 
 * Handles generation of vector embeddings for content chunks using OpenAI's 
 * text-embedding-3-small model. Provides cost tracking and error handling
 * for production use with Content Chat feature.
 */

// Model configuration for embeddings
export const EMBEDDING_CONFIG = {
  model: 'text-embedding-3-small',
  dimensions: 1536, // Default dimension count for text-embedding-3-small
  maxTokens: 8191, // Maximum tokens per request for text-embedding-3-small
  encoding: 'cl100k_base' // Token encoding used by the model
} as const

// Cost tracking (as of 2024 pricing)
export const EMBEDDING_PRICING = {
  costPerToken: 0.00000002, // $0.00002 per 1K tokens
  costPer1K: 0.00002
} as const

// Batch processing configuration
export const BATCH_CONFIG = {
  defaultBatchSize: 100, // Process 100 chunks per batch as specified in CHAT.md
  maxRetries: 3,
  retryDelays: [1000, 2000, 4000], // Exponential backoff delays in milliseconds
  maxConcurrentBatches: 3 // Limit concurrent batch operations
} as const

/**
 * Validate OpenAI configuration
 */
export function validateOpenAIConfig(): void {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }
  
  if (process.env.OPENAI_API_KEY.length < 20) {
    throw new Error('OPENAI_API_KEY appears to be invalid (too short)')
  }
}

/**
 * Create OpenAI client instance
 */
function createOpenAIClient(): OpenAI {
  validateOpenAIConfig()
  
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    // Optional: Configure additional client options
    timeout: 30000, // 30 second timeout
    maxRetries: 3
  })
}

/**
 * Generate embedding for a single text input
 * 
 * @param text - The text to generate embeddings for
 * @param options - Optional configuration
 * @returns Promise resolving to embedding vector and usage stats
 */
export async function generateEmbedding(
  text: string,
  options: {
    model?: string
    dimensions?: number
  } = {}
): Promise<{
  embedding: number[]
  usage: {
    promptTokens: number
    totalTokens: number
  }
  model: string
  cost: number
}> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text input is required for embedding generation')
  }

  const model = options.model || EMBEDDING_CONFIG.model
  const dimensions = options.dimensions || EMBEDDING_CONFIG.dimensions

  try {
    const client = createOpenAIClient()
    
    console.log(`Generating embedding for text (${text.length} chars) using model: ${model}`)
    
    const response = await client.embeddings.create({
      model,
      input: text,
      dimensions,
      encoding_format: 'float'
    })

    if (!response.data || response.data.length === 0) {
      throw new Error('No embedding data returned from OpenAI API')
    }

    const embedding = response.data[0].embedding
    const usage = response.usage

    // Calculate cost
    const cost = usage.total_tokens * EMBEDDING_PRICING.costPerToken

    console.log(`Embedding generated: ${embedding.length} dimensions, ${usage.total_tokens} tokens, $${cost.toFixed(6)} cost`)

    return {
      embedding,
      usage: {
        promptTokens: usage.prompt_tokens,
        totalTokens: usage.total_tokens
      },
      model,
      cost
    }
  } catch (error) {
    console.error('Failed to generate embedding:', error)
    
    // Handle different types of OpenAI API errors
    if (error instanceof Error) {
      if (error.message.includes('insufficient_quota')) {
        throw new Error('OpenAI API quota exceeded. Please check your billing.')
      }
      if (error.message.includes('invalid_api_key')) {
        throw new Error('Invalid OpenAI API key. Please check your configuration.')
      }
      if (error.message.includes('rate_limit')) {
        throw new Error('OpenAI API rate limit exceeded. Please retry later.')
      }
      if (error.message.includes('model_not_found')) {
        throw new Error(`OpenAI model '${model}' not found or not accessible.`)
      }
    }
    
    throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Generate embeddings for multiple text inputs using batch processing
 * 
 * @param texts - Array of text strings to generate embeddings for
 * @param options - Batch processing configuration options
 * @returns Promise resolving to batch processing results
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  options: {
    batchSize?: number
    onProgress?: (progress: BatchProgress) => void
    model?: string
    dimensions?: number
    maxRetries?: number
  } = {}
): Promise<EmbeddingBatchResult> {
  if (!texts || texts.length === 0) {
    throw new Error('Text array is required for batch embedding generation')
  }

  const startTime = Date.now()
  const batchSize = options.batchSize || BATCH_CONFIG.defaultBatchSize
  const model = options.model || EMBEDDING_CONFIG.model
  const dimensions = options.dimensions || EMBEDDING_CONFIG.dimensions
  const maxRetries = options.maxRetries || BATCH_CONFIG.maxRetries

  // Filter out empty texts and create indexed mapping
  const validTexts = texts
    .map((text, index) => ({ text: text?.trim() || '', originalIndex: index }))
    .filter(item => item.text.length > 0)

  if (validTexts.length === 0) {
    throw new Error('No valid text inputs found for embedding generation')
  }

  const totalBatches = Math.ceil(validTexts.length / batchSize)
  const results: EmbeddingBatchResult = {
    embeddings: [],
    failures: [],
    totalCost: 0,
    totalTokens: 0,
    batchesProcessed: 0,
    processingTime: 0,
    successRate: 0
  }

  console.log(`Starting batch embedding generation: ${validTexts.length} texts, ${totalBatches} batches`)

  // Process batches sequentially to respect rate limits
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batchStart = batchIndex * batchSize
    const batchEnd = Math.min(batchStart + batchSize, validTexts.length)
    const batch = validTexts.slice(batchStart, batchEnd)

    console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} texts)`)

    try {
      const batchResult = await processBatchWithRetry(
        batch.map(item => item.text),
        batch.map(item => item.originalIndex),
        { model, dimensions, maxRetries }
      )

      // Aggregate results
      results.embeddings.push(...batchResult.embeddings)
      results.failures.push(...batchResult.failures)
      results.totalCost += batchResult.totalCost
      results.totalTokens += batchResult.totalTokens
      results.batchesProcessed++

      // Report progress
      if (options.onProgress) {
        const processedTexts = (batchIndex + 1) * batchSize
        const estimatedTimeRemaining = batchIndex > 0 
          ? ((Date.now() - startTime) / (batchIndex + 1)) * (totalBatches - batchIndex - 1)
          : undefined

        options.onProgress({
          totalTexts: validTexts.length,
          processedTexts: Math.min(processedTexts, validTexts.length),
          currentBatch: batchIndex + 1,
          totalBatches,
          successfulEmbeddings: results.embeddings.length,
          failedEmbeddings: results.failures.length,
          totalCost: results.totalCost,
          totalTokens: results.totalTokens,
          estimatedTimeRemaining
        })
      }

    } catch (error) {
      console.error(`Batch ${batchIndex + 1} failed completely:`, error)
      
      // Add all texts in this batch as failures
      batch.forEach(item => {
        results.failures.push({
          text: item.text,
          index: item.originalIndex,
          error: error instanceof Error ? error.message : 'Unknown batch error',
          retryCount: maxRetries
        })
      })
    }

    // Add small delay between batches to be respectful to the API
    if (batchIndex < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  // Calculate final metrics
  results.processingTime = Date.now() - startTime
  results.successRate = (results.embeddings.length / validTexts.length) * 100

  console.log(`Batch embedding completed: ${results.embeddings.length}/${validTexts.length} successful, ` +
              `${results.failures.length} failures, $${results.totalCost.toFixed(6)} cost, ` +
              `${results.processingTime}ms duration`)

  return results
}

/**
 * Process a single batch with retry logic
 * 
 * @param texts - Array of text strings for this batch
 * @param originalIndices - Original positions of texts in the input array
 * @param options - Processing options
 * @returns Promise resolving to batch results
 */
async function processBatchWithRetry(
  texts: string[],
  originalIndices: number[],
  options: {
    model: string
    dimensions: number
    maxRetries: number
  }
): Promise<{
  embeddings: EmbeddingResult[]
  failures: EmbeddingFailure[]
  totalCost: number
  totalTokens: number
}> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      const client = createOpenAIClient()
      
      const response = await client.embeddings.create({
        model: options.model,
        input: texts,
        dimensions: options.dimensions,
        encoding_format: 'float'
      })

      if (!response.data || response.data.length !== texts.length) {
        throw new Error(`Expected ${texts.length} embeddings, got ${response.data?.length || 0}`)
      }

      const usage = response.usage
      const totalCost = usage.total_tokens * EMBEDDING_PRICING.costPerToken

      // Map results back to original indices
      const embeddings: EmbeddingResult[] = response.data.map((embeddingData, batchIndex) => ({
        text: texts[batchIndex],
        embedding: embeddingData.embedding,
        index: originalIndices[batchIndex],
        tokens: Math.ceil(usage.total_tokens / texts.length), // Approximate tokens per text
        cost: totalCost / texts.length // Approximate cost per text
      }))

      return {
        embeddings,
        failures: [],
        totalCost,
        totalTokens: usage.total_tokens
      }

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      
      console.error(`Batch attempt ${attempt + 1} failed:`, lastError.message)

      // Check if it's a retryable error
      if (isRetryableError(lastError) && attempt < options.maxRetries) {
        const delay = BATCH_CONFIG.retryDelays[Math.min(attempt, BATCH_CONFIG.retryDelays.length - 1)]
        console.log(`Retrying batch in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      } else {
        break
      }
    }
  }

  // All retry attempts failed, return failures for all texts
  const failures: EmbeddingFailure[] = texts.map((text, batchIndex) => ({
    text,
    index: originalIndices[batchIndex],
    error: lastError?.message || 'Unknown error after retries',
    retryCount: options.maxRetries
  }))

  return {
    embeddings: [],
    failures,
    totalCost: 0,
    totalTokens: 0
  }
}

/**
 * Check if an error is retryable (rate limits, temporary failures)
 * 
 * @param error - Error to check
 * @returns True if error should be retried
 */
function isRetryableError(error: Error): boolean {
  const errorMessage = error.message.toLowerCase()
  
  // Retryable errors
  if (errorMessage.includes('rate_limit') || 
      errorMessage.includes('rate limit') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('503') ||
      errorMessage.includes('502') ||
      errorMessage.includes('500')) {
    return true
  }
  
  // Non-retryable errors (quota, auth, invalid input)
  if (errorMessage.includes('insufficient_quota') ||
      errorMessage.includes('invalid_api_key') ||
      errorMessage.includes('model_not_found') ||
      errorMessage.includes('invalid_request') ||
      errorMessage.includes('400')) {
    return false
  }
  
  // Default to retryable for unknown errors
  return true
}

/**
 * Validate array of texts for batch embedding generation
 * 
 * @param texts - Array of texts to validate
 * @returns Validation result with statistics
 */
export function validateTextsForBatch(texts: string[]): {
  isValid: boolean
  validTexts: number
  emptyTexts: number
  oversizedTexts: number
  totalEstimatedTokens: number
  estimatedCost: number
  estimatedBatches: number
  warnings: string[]
} {
  if (!texts || !Array.isArray(texts)) {
    return {
      isValid: false,
      validTexts: 0,
      emptyTexts: 0,
      oversizedTexts: 0,
      totalEstimatedTokens: 0,
      estimatedCost: 0,
      estimatedBatches: 0,
      warnings: ['Input must be an array of strings']
    }
  }

  let validTexts = 0
  let emptyTexts = 0
  let oversizedTexts = 0
  let totalEstimatedTokens = 0
  const warnings: string[] = []

  for (const text of texts) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      emptyTexts++
      continue
    }

    const validation = validateTextForEmbedding(text)
    if (validation.isValid) {
      validTexts++
      totalEstimatedTokens += validation.estimatedTokens
    } else {
      oversizedTexts++
      warnings.push(`Text too long: ${validation.estimatedTokens} tokens (max: ${EMBEDDING_CONFIG.maxTokens})`)
    }
  }

  const estimatedCost = estimateEmbeddingCost(totalEstimatedTokens)
  const estimatedBatches = Math.ceil(validTexts / BATCH_CONFIG.defaultBatchSize)

  if (emptyTexts > 0) {
    warnings.push(`${emptyTexts} empty texts will be skipped`)
  }
  if (oversizedTexts > 0) {
    warnings.push(`${oversizedTexts} texts exceed token limit and will fail`)
  }
  if (estimatedCost > 1.0) {
    warnings.push(`High estimated cost: $${estimatedCost.toFixed(2)}`)
  }

  return {
    isValid: validTexts > 0,
    validTexts,
    emptyTexts,
    oversizedTexts,
    totalEstimatedTokens,
    estimatedCost,
    estimatedBatches,
    warnings
  }
}

/**
 * Test OpenAI API connection and embedding generation
 * Useful for health checks and configuration validation
 */
export async function testEmbeddingService(): Promise<{
  isWorking: boolean
  model: string
  dimensions: number
  testCost: number
  error?: string
}> {
  try {
    const testText = 'This is a test for the OpenAI embedding service.'
    const result = await generateEmbedding(testText)
    
    return {
      isWorking: true,
      model: result.model,
      dimensions: result.embedding.length,
      testCost: result.cost
    }
  } catch (error) {
    return {
      isWorking: false,
      model: EMBEDDING_CONFIG.model,
      dimensions: EMBEDDING_CONFIG.dimensions,
      testCost: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Estimate cost for embedding generation
 * 
 * @param tokenCount - Number of tokens to be processed
 * @returns Estimated cost in USD
 */
export function estimateEmbeddingCost(tokenCount: number): number {
  return tokenCount * EMBEDDING_PRICING.costPerToken
}

/**
 * Validate text length for embedding generation
 * 
 * @param text - Text to validate
 * @returns Object with validation result and token estimate
 */
export function validateTextForEmbedding(text: string): {
  isValid: boolean
  estimatedTokens: number
  error?: string
} {
  if (!text || text.trim().length === 0) {
    return {
      isValid: false,
      estimatedTokens: 0,
      error: 'Text cannot be empty'
    }
  }

  // Rough token estimation (4 characters ≈ 1 token for English text)
  const estimatedTokens = Math.ceil(text.length / 4)
  
  if (estimatedTokens > EMBEDDING_CONFIG.maxTokens) {
    return {
      isValid: false,
      estimatedTokens,
      error: `Text is too long. Estimated ${estimatedTokens} tokens, maximum is ${EMBEDDING_CONFIG.maxTokens} tokens`
    }
  }

  return {
    isValid: true,
    estimatedTokens
  }
}

// Export configuration for use in other modules
export { EMBEDDING_CONFIG as config }