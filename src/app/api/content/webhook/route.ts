import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { syncUserContent } from '@/lib/content-sync'
import { db } from '@/lib/database'

/**
 * POST /api/content/webhook
 * 
 * Webflow webhook handler for real-time content sync
 * Handles item creation, updates, and deletions from Webflow CMS
 */

// Webhook configuration
const WEBHOOK_CONFIG = {
  maxPayloadSize: 10 * 1024 * 1024, // 10MB max payload
  signatureHeader: 'webflow-webhook-signature',
  eventHeader: 'webflow-webhook-event',
  supportedEvents: [
    'collection_item_created',
    'collection_item_changed', 
    'collection_item_deleted',
    'collection_item_unpublished'
  ] as const
}

type WebflowWebhookEvent = typeof WEBHOOK_CONFIG.supportedEvents[number]

interface WebflowWebhookPayload {
  _id: string
  site: string
  name: string
  slug: string
  'last-published'?: string
  'last-updated': string
  created: string
  published: boolean
  draft: boolean
  fieldData?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Verify webhook signature (if configured)
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string | null
): boolean {
  if (!secret || !signature) {
    // If no secret is configured, allow webhooks (development mode)
    console.warn('Webhook signature verification skipped (no secret configured)')
    return true
  }

  try {
    // Remove any signature prefix (e.g., "sha256=")
    const cleanSignature = signature.replace(/^sha256=/, '')
    
    // Calculate expected signature
    const expectedSignature = createHash('sha256')
      .update(payload)
      .update(secret)
      .digest('hex')
    
    // Use timing-safe comparison
    const signatureBuffer = Buffer.from(cleanSignature, 'hex')
    const expectedBuffer = Buffer.from(expectedSignature, 'hex')
    
    return signatureBuffer.length === expectedBuffer.length &&
           timingSafeEqual(signatureBuffer, expectedBuffer)
  } catch (error) {
    console.error('Webhook signature verification failed:', error)
    return false
  }
}

/**
 * Find user by site ID (this would need to be enhanced based on your user-site mapping)
 */
async function getUserBySiteId(siteId: string): Promise<string | null> {
  try {
    // This is a simplified approach - in production you'd want a proper site->user mapping
    // For now, we'll look for any user who has content from this site
    const { rows } = await db.query(`
      SELECT DISTINCT userid FROM webflow_content 
      WHERE metadata->>'siteId' = $1 
      ORDER BY updatedat DESC 
      LIMIT 1
    `, [siteId])
    
    if (rows.length > 0) {
      return rows[0].userid
    }
    
    // Alternative: if no content found, return null (webflow_connections doesn't have site metadata)
    return null
  } catch (error) {
    console.error('Failed to find user by site ID:', error)
    return null
  }
}

/**
 * Handle item created/updated events
 */
async function handleItemUpsert(
  userId: string,
  event: WebflowWebhookEvent,
  payload: WebflowWebhookPayload
): Promise<void> {
  console.log(`Handling ${event} for item ${payload._id}`)
  
  try {
    // For now, trigger a full sync for the user
    // TODO: Implement incremental sync for specific items
    console.log(`Triggering sync for user ${userId} due to ${event}`)
    
    const syncResult = await syncUserContent(userId)
    
    console.log(`Webhook-triggered sync completed:`, {
      success: syncResult.success,
      itemsProcessed: syncResult.itemsProcessed,
      chunksCreated: syncResult.chunksCreated,
      errors: syncResult.errors.length
    })
    
    // Log webhook operation
    await db.query(`
      INSERT INTO content_operations (
        userid, operationtype, affecteditems, status, 
        startedat, completedat
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      userId,
      `webhook_${event}`,
      JSON.stringify({
        itemId: payload._id,
        siteName: payload.site,
        itemName: payload.name,
        syncTriggered: true,
        syncResult: {
          success: syncResult.success,
          itemsProcessed: syncResult.itemsProcessed,
          chunksCreated: syncResult.chunksCreated
        }
      }),
      syncResult.success ? 'completed' : 'failed',
      syncResult.startedAt,
      syncResult.completedAt
    ])
    
  } catch (error) {
    console.error(`Failed to handle ${event} for item ${payload._id}:`, error)
    
    // Log failed webhook operation
    await db.query(`
      INSERT INTO content_operations (
        userId, operationType, affectedItems, status, error,
        startedAt, completedAt
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      userId,
      `webhook_${event}`,
      JSON.stringify({
        itemId: payload._id,
        siteName: payload.site,
        itemName: payload.name
      }),
      'failed',
      error instanceof Error ? error.message : 'Unknown error',
      new Date().toISOString(),
      new Date().toISOString()
    ])
    
    throw error
  }
}

/**
 * Handle item deleted/unpublished events
 */
async function handleItemDelete(
  userId: string,
  event: WebflowWebhookEvent,
  payload: WebflowWebhookPayload
): Promise<void> {
  console.log(`Handling ${event} for item ${payload._id}`)
  
  try {
    // Delete the item and its chunks from our database
    const { rows } = await db.query(`
      DELETE FROM webflow_content 
      WHERE userId = $1 AND itemId = $2
      RETURNING id
    `, [userId, payload._id])
    
    const deletedCount = rows.length
    
    console.log(`Deleted ${deletedCount} content records for item ${payload._id}`)
    
    // Log deletion operation
    await db.query(`
      INSERT INTO content_operations (
        userId, operationType, affectedItems, status,
        startedAt, completedAt
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      userId,
      `webhook_${event}`,
      JSON.stringify({
        itemId: payload._id,
        siteName: payload.site,
        itemName: payload.name,
        deletedRecords: deletedCount
      }),
      'completed',
      new Date().toISOString(),
      new Date().toISOString()
    ])
    
  } catch (error) {
    console.error(`Failed to handle ${event} for item ${payload._id}:`, error)
    
    // Log failed deletion
    await db.query(`
      INSERT INTO content_operations (
        userId, operationType, affectedItems, status, error,
        startedAt, completedAt
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      userId,
      `webhook_${event}`,
      JSON.stringify({
        itemId: payload._id,
        siteName: payload.site,
        itemName: payload.name
      }),
      'failed',
      error instanceof Error ? error.message : 'Unknown error',
      new Date().toISOString(),
      new Date().toISOString()
    ])
    
    throw error
  }
}

/**
 * Main webhook handler
 */
export async function POST(request: NextRequest) {
  try {
    // Check content length
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > WEBHOOK_CONFIG.maxPayloadSize) {
      return NextResponse.json(
        { error: 'Payload too large' },
        { status: 413 }
      )
    }

    // Get headers
    const signature = request.headers.get(WEBHOOK_CONFIG.signatureHeader)
    const eventType = request.headers.get(WEBHOOK_CONFIG.eventHeader) as WebflowWebhookEvent
    
    // Validate event type
    if (!eventType || !WEBHOOK_CONFIG.supportedEvents.includes(eventType)) {
      console.warn(`Unsupported webhook event: ${eventType}`)
      return NextResponse.json(
        { 
          error: 'Unsupported event type',
          supportedEvents: WEBHOOK_CONFIG.supportedEvents
        },
        { status: 400 }
      )
    }

    // Get payload
    const payloadText = await request.text()
    let payload: WebflowWebhookPayload
    
    try {
      payload = JSON.parse(payloadText)
    } catch (parseError) {
      console.error('Failed to parse webhook payload:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // Verify signature if configured
    const webhookSecret = process.env.WEBFLOW_WEBHOOK_SECRET || null
    if (!verifyWebhookSignature(payloadText, signature, webhookSecret)) {
      console.error('Webhook signature verification failed')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Find user for this site
    const siteId = payload.site || ''
    const userId = await getUserBySiteId(siteId)
    if (!userId) {
      console.warn(`No user found for site ${siteId}, ignoring webhook`)
      return NextResponse.json(
        { 
          message: 'No user found for site',
          siteId: siteId
        },
        { status: 200 } // Return 200 to prevent webhook retries
      )
    }

    console.log(`Processing webhook: ${eventType} for user ${userId}, item ${payload._id}`)

    // Handle the event
    switch (eventType) {
      case 'collection_item_created':
      case 'collection_item_changed':
        await handleItemUpsert(userId, eventType, payload)
        break
        
      case 'collection_item_deleted':
      case 'collection_item_unpublished':
        await handleItemDelete(userId, eventType, payload)
        break
        
      default:
        console.warn(`Unhandled event type: ${eventType}`)
        return NextResponse.json(
          { error: 'Unhandled event type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${eventType}`,
      eventType,
      itemId: payload._id,
      processedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Webhook processing failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/content/webhook
 * 
 * Webhook configuration and status endpoint
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      webhookEndpoint: `${request.nextUrl.origin}/api/content/webhook`,
      supportedEvents: WEBHOOK_CONFIG.supportedEvents,
      signatureVerification: !!process.env.WEBFLOW_WEBHOOK_SECRET,
      maxPayloadSize: WEBHOOK_CONFIG.maxPayloadSize,
      headers: {
        signature: WEBHOOK_CONFIG.signatureHeader,
        event: WEBHOOK_CONFIG.eventHeader
      },
      setup: {
        instructions: [
          '1. In Webflow, go to Project Settings > Integrations > Webhooks',
          '2. Add a new webhook with this URL',
          '3. Select events: collection_item_created, collection_item_changed, collection_item_deleted',
          '4. Add WEBFLOW_WEBHOOK_SECRET to environment variables for signature verification (optional but recommended)'
        ],
        environmentVariable: 'WEBFLOW_WEBHOOK_SECRET'
      }
    })

  } catch (error) {
    console.error('Webhook status check failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to get webhook status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}