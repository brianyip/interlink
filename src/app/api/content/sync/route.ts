import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { 
  syncUserContent, 
  getSyncStatus, 
  clearUserContent 
} from '@/lib/content-sync'
import { validateWebflowConfig } from '@/lib/webflow-client'

/**
 * GET /api/content/sync
 * 
 * Get sync status and trigger manual sync
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

    // Validate Webflow configuration
    try {
      validateWebflowConfig()
    } catch (configError) {
      return NextResponse.json({
        error: 'Webflow configuration incomplete',
        details: configError instanceof Error ? configError.message : 'Unknown configuration error'
      }, { status: 500 })
    }

    // Get current sync status
    const syncStatus = await getSyncStatus(session.user.id)
    
    return NextResponse.json({
      status: 'ready',
      ...syncStatus,
      actions: {
        startSync: '/api/content/sync',
        clearContent: '/api/content/sync?action=clear'
      }
    })

  } catch (error) {
    console.error('Sync status check failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to check sync status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/content/sync
 * 
 * Trigger content sync from Webflow
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

    // Validate Webflow configuration
    try {
      validateWebflowConfig()
    } catch (configError) {
      return NextResponse.json({
        error: 'Webflow configuration incomplete',
        details: configError instanceof Error ? configError.message : 'Unknown configuration error'
      }, { status: 500 })
    }

    // Parse request body for options
    const body = await request.json().catch(() => ({}))
    const { 
      action = 'sync',
      clearFirst = false
    } = body
    // collections = null // Specific collections to sync (future enhancement)

    // Handle clear content action
    if (action === 'clear') {
      await clearUserContent(session.user.id)
      return NextResponse.json({
        success: true,
        message: 'All content cleared successfully',
        clearedAt: new Date().toISOString()
      })
    }

    // Clear existing content if requested
    if (clearFirst) {
      console.log(`Clearing existing content for user ${session.user.id} before sync`)
      await clearUserContent(session.user.id)
    }

    console.log(`Starting content sync for user ${session.user.id}`)
    
    // Start content sync
    const syncResult = await syncUserContent(session.user.id)

    // Return detailed sync results
    return NextResponse.json({
      success: syncResult.success,
      message: syncResult.success 
        ? 'Content sync completed successfully' 
        : 'Content sync completed with errors',
      result: {
        sitesProcessed: syncResult.sitesProcessed,
        collectionsProcessed: syncResult.collectionsProcessed,
        itemsProcessed: syncResult.itemsProcessed,
        chunksCreated: syncResult.chunksCreated,
        duration: syncResult.duration,
        startedAt: syncResult.startedAt,
        completedAt: syncResult.completedAt
      },
      errors: syncResult.errors.length > 0 ? syncResult.errors : undefined,
      stats: {
        averageChunksPerItem: syncResult.itemsProcessed > 0 
          ? Math.round((syncResult.chunksCreated / syncResult.itemsProcessed) * 100) / 100 
          : 0,
        processingSpeed: syncResult.duration > 0 
          ? Math.round((syncResult.itemsProcessed / (syncResult.duration / 1000)) * 100) / 100 
          : 0,
        successRate: syncResult.sitesProcessed > 0 
          ? Math.round(((syncResult.sitesProcessed - syncResult.errors.length) / syncResult.sitesProcessed) * 10000) / 100 
          : 100
      }
    }, { 
      status: syncResult.success ? 200 : 207 // 207 Multi-Status for partial success
    })

  } catch (error) {
    console.error('Content sync failed:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Content sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/content/sync
 * 
 * Clear all synced content for user
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication with Better Auth
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Clear all content
    await clearUserContent(session.user.id)

    return NextResponse.json({
      success: true,
      message: 'All content cleared successfully',
      clearedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Content clear failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to clear content',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}