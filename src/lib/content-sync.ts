import tiktoken from 'tiktoken'
import { createHash } from 'crypto'
import { db } from './database'
import { 
  getWebflowCollections, 
  getWebflowCollectionItems,
  testWebflowConnection 
} from './webflow-client'
import type { 
  WebflowContent, 
  ContentChunk, 
  ContentSyncResult,
  WebflowCollection,
  WebflowItem 
} from './types'

/**
 * Content Sync Service for Webflow CMS Integration
 * 
 * Handles fetching, processing, and storing content from Webflow CMS
 * with smart chunking, deduplication, and rate limiting
 */

// Rate limiting configuration (60 requests per minute as per Webflow API limits)
const RATE_LIMIT = {
  requests: 60,
  windowMs: 60 * 1000, // 1 minute
  backoffDelays: [1000, 2000, 4000, 8000, 16000] // Exponential backoff in milliseconds
}

// Content processing configuration
const CHUNK_CONFIG = {
  maxTokens: 1500, // Maximum tokens per chunk
  overlapTokens: 100, // Overlap between chunks
  minChunkSize: 50, // Minimum viable chunk size
  encoding: 'text-embedding-3-small' // OpenAI model for embeddings
}

// Rate limiting state (in production, use Redis)
const rateLimitState = new Map<string, { count: number; resetTime: number }>()

/**
 * Initialize tiktoken encoder for token counting
 */
function getTokenEncoder() {
  try {
    // Use cl100k_base encoding which is compatible with text-embedding-3-small
    return tiktoken.get_encoding('cl100k_base')
  } catch (error) {
    console.error('Failed to initialize tiktoken encoder:', error)
    throw new Error('Token encoder initialization failed')
  }
}

/**
 * Rate limiting middleware with exponential backoff
 */
async function rateLimitedRequest<T>(
  userId: string,
  requestFn: () => Promise<T>,
  attempt = 0
): Promise<T> {
  const now = Date.now()
  const userState = rateLimitState.get(userId) || { count: 0, resetTime: now + RATE_LIMIT.windowMs }
  
  // Reset counter if window has expired
  if (now > userState.resetTime) {
    userState.count = 0
    userState.resetTime = now + RATE_LIMIT.windowMs
  }
  
  // Check rate limit
  if (userState.count >= RATE_LIMIT.requests) {
    if (attempt >= RATE_LIMIT.backoffDelays.length) {
      throw new Error('Rate limit exceeded after maximum retries')
    }
    
    const delay = RATE_LIMIT.backoffDelays[attempt]
    console.log(`Rate limit reached for user ${userId}, waiting ${delay}ms (attempt ${attempt + 1})`)
    
    await new Promise(resolve => setTimeout(resolve, delay))
    return rateLimitedRequest(userId, requestFn, attempt + 1)
  }
  
  // Execute request and update counter
  try {
    userState.count++
    rateLimitState.set(userId, userState)
    return await requestFn()
  } catch (error) {
    // If it's a rate limit error from Webflow, retry with backoff
    if (error instanceof Error && error.message.includes('rate limit')) {
      if (attempt < RATE_LIMIT.backoffDelays.length) {
        const delay = RATE_LIMIT.backoffDelays[attempt]
        console.log(`Webflow rate limit detected, backing off ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return rateLimitedRequest(userId, requestFn, attempt + 1)
      }
    }
    throw error
  }
}

/**
 * Generate SHA-256 hash for content deduplication
 */
function generateContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Smart content chunking with tiktoken token counting
 */
function chunkContent(
  content: string
  // metadata could be used for context in future enhancements
): Array<{ content: string; tokens: number; chunkIndex: number }> {
  const encoder = getTokenEncoder()
  const chunks: Array<{ content: string; tokens: number; chunkIndex: number }> = []
  
  // Clean and normalize content
  const cleanContent = content
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\n+/g, '\n') // Normalize line breaks
    .trim()
  
  if (!cleanContent) {
    return chunks
  }
  
  // For short content, return as single chunk
  const totalTokens = encoder.encode(cleanContent).length
  if (totalTokens <= CHUNK_CONFIG.maxTokens) {
    return [{
      content: cleanContent,
      tokens: totalTokens,
      chunkIndex: 0
    }]
  }
  
  // Split by natural boundaries (paragraphs, sentences)
  const paragraphs = cleanContent.split(/\n\s*\n/)
  let currentChunk = ''
  let currentTokens = 0
  let chunkIndex = 0
  let overlapContent = ''
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim()
    if (!paragraph) continue
    
    const paragraphTokens = encoder.encode(paragraph).length
    
    // If single paragraph exceeds max tokens, split by sentences
    if (paragraphTokens > CHUNK_CONFIG.maxTokens) {
      // Save current chunk if it has content
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          tokens: currentTokens,
          chunkIndex: chunkIndex++
        })
        
        // Set up overlap for next chunk
        const words = currentChunk.trim().split(' ')
        overlapContent = words.slice(-50).join(' ') // Last 50 words as overlap
      }
      
      // Split large paragraph by sentences
      const sentences = paragraph.split(/[.!?]+/)
      currentChunk = overlapContent
      currentTokens = overlapContent ? encoder.encode(overlapContent).length : 0
      
      for (const sentence of sentences) {
        const trimmedSentence = sentence.trim()
        if (!trimmedSentence) continue
        
        const sentenceTokens = encoder.encode(trimmedSentence).length
        
        if (currentTokens + sentenceTokens > CHUNK_CONFIG.maxTokens && currentChunk.trim()) {
          chunks.push({
            content: currentChunk.trim(),
            tokens: currentTokens,
            chunkIndex: chunkIndex++
          })
          
          // Set up overlap
          const words = currentChunk.trim().split(' ')
          overlapContent = words.slice(-30).join(' ') // Last 30 words as overlap
          currentChunk = overlapContent + ' ' + trimmedSentence
          currentTokens = encoder.encode(currentChunk).length
        } else {
          currentChunk += (currentChunk ? ' ' : '') + trimmedSentence
          currentTokens += sentenceTokens
        }
      }
    } else {
      // Normal paragraph processing
      if (currentTokens + paragraphTokens > CHUNK_CONFIG.maxTokens && currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          tokens: currentTokens,
          chunkIndex: chunkIndex++
        })
        
        // Set up overlap for next chunk
        const words = currentChunk.trim().split(' ')
        overlapContent = words.slice(-20).join(' ') // Last 20 words as overlap
        currentChunk = overlapContent + '\n\n' + paragraph
        currentTokens = encoder.encode(currentChunk).length
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph
        currentTokens += paragraphTokens
      }
    }
  }
  
  // Add final chunk if it has content
  if (currentChunk.trim() && currentTokens >= CHUNK_CONFIG.minChunkSize) {
    chunks.push({
      content: currentChunk.trim(),
      tokens: currentTokens,
      chunkIndex: chunkIndex
    })
  }
  
  encoder.free() // Clean up encoder
  
  return chunks.filter(chunk => 
    chunk.content.length > 10 && 
    chunk.tokens >= CHUNK_CONFIG.minChunkSize
  )
}

/**
 * Extract meaningful content from Webflow item
 */
function extractItemContent(item: WebflowItem): string {
  const contentFields = []
  
  // Common Webflow CMS field names that contain content
  const contentFieldNames = [
    'content', 'body', 'description', 'text', 'excerpt', 
    'summary', 'main-content', 'post-content', 'article-content'
  ]
  
  // Add title/name from the item itself
  if (item.name) {
    contentFields.push(`Title: ${item.name}`)
  }
  
  // Extract content from known field names (check both fieldData and direct properties)
  const itemData = item.fieldData || (item as unknown as Record<string, unknown>)
  
  for (const fieldName of contentFieldNames) {
    const fieldValue = itemData[fieldName]
    if (fieldValue && typeof fieldValue === 'string') {
      // Remove HTML tags for plain text content
      const cleanContent = fieldValue
        .replace(/<[^>]*>/g, ' ') // Remove HTML tags
        .replace(/&[^;]+;/g, ' ') // Remove HTML entities
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
      
      if (cleanContent.length > 20) {
        contentFields.push(cleanContent)
      }
    }
  }
  
  // Add any other text fields
  for (const [key, value] of Object.entries(itemData)) {
    if (
      !contentFieldNames.includes(key.toLowerCase()) &&
      typeof value === 'string' &&
      value.length > 20 &&
      !key.includes('url') &&
      !key.includes('link') &&
      !key.includes('id') &&
      !key.includes('updated-') &&
      !key.includes('created-') &&
      !key.includes('published-')
    ) {
      const cleanValue = String(value)
        .replace(/<[^>]*>/g, ' ')
        .replace(/&[^;]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      if (cleanValue.length > 20) {
        contentFields.push(`${key}: ${cleanValue}`)
      }
    }
  }
  
  return contentFields.join('\n\n')
}

/**
 * Store content in database with deduplication
 */
async function storeWebflowContent(
  userId: string,
  collection: WebflowCollection,
  item: WebflowItem,
  content: string
): Promise<WebflowContent | null> {
  if (!content || content.trim().length < 20) {
    return null
  }
  
  const contentHash = generateContentHash(content)
  
  try {
    // Check if content already exists (deduplication)
    const existingContent = await db.query(`
      SELECT id FROM webflow_content 
      WHERE userId = $1 AND contentHash = $2
    `, [userId, contentHash])
    
    if (existingContent.rows.length > 0) {
      console.log(`Content already exists for item ${item.id}, skipping`)
      return existingContent.rows[0] as WebflowContent
    }
    
    // Insert new content
    const { rows } = await db.query(`
      INSERT INTO webflow_content (
        userId, collectionId, itemId, collectionName, title, slug,
        lastPublished, contentHash, metadata, createdAt, updatedAt
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
    `, [
      userId,
      collection._id,
      item._id,
      collection.name,
      item.name || 'Untitled',
      item.slug,
      item['published-on'] ? new Date(item['published-on']) : null,
      contentHash,
      JSON.stringify({
        webflowUrl: `https://${collection.slug}.webflow.io/items/${item._id}`,
        itemFields: Object.keys(item.fieldData || {}),
        contentLength: content.length,
        collectionSlug: collection.slug,
        itemId: item._id,
        collectionId: collection._id
      })
    ])
    
    return rows[0] as WebflowContent
  } catch (error) {
    console.error('Failed to store Webflow content:', error)
    throw error
  }
}

/**
 * Store content chunks in database
 */
async function storeContentChunks(
  userId: string,
  contentId: string,
  chunks: Array<{ content: string; tokens: number; chunkIndex: number }>
): Promise<ContentChunk[]> {
  if (chunks.length === 0) {
    return []
  }
  
  try {
    // Delete existing chunks for this content (in case of re-sync)
    await db.query(`
      DELETE FROM content_chunks WHERE contentId = $1
    `, [contentId])
    
    // Insert new chunks
    const chunkInserts = chunks.map((chunk, index) => 
      db.query(`
        INSERT INTO content_chunks (
          contentId, userId, chunkIndex, content, tokens, metadata, createdAt
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `, [
        contentId,
        userId,
        chunk.chunkIndex,
        chunk.content,
        chunk.tokens,
        JSON.stringify({
          chunkSize: chunk.content.length,
          wordCount: chunk.content.split(/\s+/).length,
          position: index,
          totalChunks: chunks.length
        })
      ])
    )
    
    const results = await Promise.all(chunkInserts)
    return results.map(result => result.rows[0] as ContentChunk)
  } catch (error) {
    console.error('Failed to store content chunks:', error)
    throw error
  }
}

/**
 * Sync content for a single Webflow collection
 */
async function syncCollection(
  userId: string,
  siteId: string,
  collection: WebflowCollection
): Promise<{
  itemsProcessed: number
  chunksCreated: number
  errors: string[]
}> {
  const stats: {
    itemsProcessed: number
    chunksCreated: number
    errors: string[]
  } = {
    itemsProcessed: 0,
    chunksCreated: 0,
    errors: []
  }
  
  try {
    console.log(`Syncing collection: ${collection.name} (${collection._id})`)
    
    let offset = 0
    const limit = 25 // Smaller batch size for rate limiting
    let hasMore = true
    
    while (hasMore) {
      try {
        // Fetch collection items with rate limiting
        const response = await rateLimitedRequest(userId, () =>
          getWebflowCollectionItems(userId, collection._id, { limit, offset })
        )
        
        const items = response.items || []
        hasMore = items.length === limit // More items if we got a full batch
        offset += items.length
        
        console.log(`Processing ${items.length} items from ${collection.name} (offset: ${offset - items.length})`)
        
        // Process each item
        for (const item of items) {
          try {
            const content = extractItemContent(item)
            
            if (content && content.trim().length >= 50) {
              // Store content in database
              const storedContent = await storeWebflowContent(userId, collection, item, content)
              
              if (storedContent) {
                // Create chunks
                const chunks = chunkContent(content)
                
                // Store chunks
                const storedChunks = await storeContentChunks(userId, storedContent.id, chunks)
                
                stats.itemsProcessed++
                stats.chunksCreated += storedChunks.length
                
                console.log(`Processed item "${item.name || item._id}": ${chunks.length} chunks, ${content.length} chars`)
              }
            } else {
              console.log(`Skipping item ${item._id}: insufficient content (${content.length} chars)`)
            }
          } catch (itemError) {
            const errorMsg = `Failed to process item ${item._id}: ${itemError instanceof Error ? itemError.message : 'Unknown error'}`
            console.error(errorMsg)
            stats.errors.push(errorMsg)
          }
        }
        
        // Small delay between batches to be gentle on the API
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
      } catch (batchError) {
        const errorMsg = `Failed to fetch items for collection ${collection._id} at offset ${offset}: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`
        console.error(errorMsg)
        stats.errors.push(errorMsg)
        break // Exit the loop on batch failure
      }
    }
    
  } catch (error) {
    const errorMsg = `Failed to sync collection ${collection._id}: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.error(errorMsg)
    stats.errors.push(errorMsg)
  }
  
  return stats
}

/**
 * Main content sync function - syncs all content for a user
 */
export async function syncUserContent(userId: string): Promise<ContentSyncResult> {
  const startTime = Date.now()
  const result: ContentSyncResult = {
    success: false,
    sitesProcessed: 0,
    collectionsProcessed: 0,
    itemsProcessed: 0,
    chunksCreated: 0,
    errors: [],
    duration: 0,
    startedAt: new Date().toISOString(),
    completedAt: ''
  }
  
  try {
    console.log(`Starting content sync for user ${userId}`)
    
    // Test Webflow connection
    const connectionTest = await testWebflowConnection(userId)
    if (!connectionTest.isValid) {
      throw new Error(`Webflow connection invalid: ${connectionTest.error}`)
    }
    
    console.log(`Webflow connection valid, found ${connectionTest.sites?.length || 0} sites`)
    
    // Process each site
    if (connectionTest.sites && connectionTest.sites.length > 0) {
      for (const siteData of connectionTest.sites) {
        try {
          const site = siteData as { _id?: string; name?: string; shortName?: string; [key: string]: unknown }
          const siteId = String(site._id || '')
          const siteName = String(site.name || site.shortName || 'Unknown Site')
          
          console.log(`Processing site: ${siteName} (${siteId})`)
          
          // Get collections for this site
          const collections = await rateLimitedRequest(userId, () =>
            getWebflowCollections(userId, siteId)
          )
          
          console.log(`Found ${collections.length} collections in site ${siteName}`)
          
          // Process each collection
          for (const collection of collections) {
            try {
              const collectionStats = await syncCollection(userId, siteId, collection)
              
              result.collectionsProcessed++
              result.itemsProcessed += collectionStats.itemsProcessed
              result.chunksCreated += collectionStats.chunksCreated
              result.errors.push(...collectionStats.errors)
              
              console.log(`Collection ${collection.name}: ${collectionStats.itemsProcessed} items, ${collectionStats.chunksCreated} chunks`)
              
            } catch (collectionError) {
              const errorMsg = `Failed to sync collection ${collection.name}: ${collectionError instanceof Error ? collectionError.message : 'Unknown error'}`
              console.error(errorMsg)
              result.errors.push(errorMsg)
            }
          }
          
          result.sitesProcessed++
          
        } catch (siteError) {
          const errorMsg = `Failed to process site ${siteData}: ${siteError instanceof Error ? siteError.message : 'Unknown error'}`
          console.error(errorMsg)
          result.errors.push(errorMsg)
        }
      }
    }
    
    result.success = result.sitesProcessed > 0 || result.itemsProcessed > 0
    result.duration = Date.now() - startTime
    result.completedAt = new Date().toISOString()
    
    console.log(`Content sync completed for user ${userId}:`, {
      sitesProcessed: result.sitesProcessed,
      collectionsProcessed: result.collectionsProcessed,
      itemsProcessed: result.itemsProcessed,
      chunksCreated: result.chunksCreated,
      errors: result.errors.length,
      duration: `${result.duration}ms`
    })
    
    // Log operation to audit table
    await db.query(`
      INSERT INTO content_operations (
        userId, operationType, affectedItems, status, 
        startedAt, completedAt
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      userId,
      'sync',
      JSON.stringify({
        sitesProcessed: result.sitesProcessed,
        collectionsProcessed: result.collectionsProcessed,
        itemsProcessed: result.itemsProcessed,
        chunksCreated: result.chunksCreated
      }),
      result.success ? 'completed' : 'failed',
      result.startedAt,
      result.completedAt
    ])
    
    return result
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('Content sync failed:', errorMsg)
    
    result.success = false
    result.errors.push(`Sync failed: ${errorMsg}`)
    result.duration = Date.now() - startTime
    result.completedAt = new Date().toISOString()
    
    // Log failed operation
    try {
      await db.query(`
        INSERT INTO content_operations (
          userId, operationType, status, error,
          startedAt, completedAt
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        userId,
        'sync',
        'failed',
        errorMsg,
        result.startedAt,
        result.completedAt
      ])
    } catch (logError) {
      console.error('Failed to log sync failure:', logError)
    }
    
    return result
  }
}

/**
 * Get sync status for user
 */
export async function getSyncStatus(userId: string): Promise<{
  lastSync: string | null
  totalContent: number
  totalChunks: number
  isConnected: boolean
}> {
  try {
    // Get last sync operation
    const lastSyncQuery = await db.query(`
      SELECT completedAt FROM content_operations
      WHERE userId = $1 AND operationType = 'sync' AND status = 'completed'
      ORDER BY completedAt DESC
      LIMIT 1
    `, [userId])
    
    // Get content stats
    const contentStatsQuery = await db.query(`
      SELECT 
        COUNT(DISTINCT wc.id) as total_content,
        COUNT(cc.id) as total_chunks
      FROM webflow_content wc
      LEFT JOIN content_chunks cc ON wc.id = cc.contentId
      WHERE wc.userId = $1
    `, [userId])
    
    // Test connection
    const connectionTest = await testWebflowConnection(userId)
    
    return {
      lastSync: lastSyncQuery.rows[0]?.completedat || null,
      totalContent: parseInt(contentStatsQuery.rows[0]?.total_content || '0'),
      totalChunks: parseInt(contentStatsQuery.rows[0]?.total_chunks || '0'),
      isConnected: connectionTest.isValid
    }
  } catch (error) {
    console.error('Failed to get sync status:', error)
    return {
      lastSync: null,
      totalContent: 0,
      totalChunks: 0,
      isConnected: false
    }
  }
}

/**
 * Clear all synced content for user (useful for re-sync)
 */
export async function clearUserContent(userId: string): Promise<void> {
  try {
    console.log(`Clearing all content for user ${userId}`)
    
    // Delete all content (cascades to chunks due to foreign key)
    await db.query(`
      DELETE FROM webflow_content WHERE userId = $1
    `, [userId])
    
    console.log(`Cleared all content for user ${userId}`)
  } catch (error) {
    console.error('Failed to clear user content:', error)
    throw error
  }
}