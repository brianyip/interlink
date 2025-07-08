import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { 
  getWebflowConnection, 
  testWebflowConnection,
  getWebflowCollections,
  validateWebflowConfig 
} from '@/lib/webflow-client'

/**
 * GET /api/webflow/status
 * 
 * Get comprehensive Webflow connection status and account information
 * Used by the UI to display connection state and available content
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
        connected: false,
        error: 'Webflow configuration incomplete',
        details: configError instanceof Error ? configError.message : 'Unknown configuration error',
        configValid: false
      })
    }

    // Get current connection
    const connection = await getWebflowConnection(session.user.id)
    
    if (!connection) {
      return NextResponse.json({
        connected: false,
        configValid: true,
        message: 'No Webflow connection found. Please authorize your account.',
        authUrl: '/api/webflow/auth'
      })
    }

    // Calculate token status
    const now = new Date()
    const expiresAt = new Date(connection.expiresAt)
    const isExpired = now > expiresAt
    const minutesUntilExpiry = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60)))

    // Test the connection and get account info
    const connectionTest = await testWebflowConnection(session.user.id)
    
    if (!connectionTest.isValid) {
      return NextResponse.json({
        connected: false,
        configValid: true,
        error: 'Webflow connection invalid',
        details: connectionTest.error,
        tokenStatus: {
          isExpired,
          expiresAt: expiresAt.toISOString(),
          minutesUntilExpiry
        },
        needsReauth: true
      })
    }

    // Get available sites and collections summary
    let sitesData: Array<{
      id: string
      name: string
      shortName: string
      lastPublished: string | null
      previewUrl: string | null
    }> = []
    let collectionsCount = 0
    
    try {
      if (connectionTest.sites && connectionTest.sites.length > 0) {
        sitesData = connectionTest.sites.map((siteUnknown: unknown) => {
          const site = siteUnknown as Record<string, unknown>
          return {
            id: String(site._id || site.id || ''),
            name: String(site.name || ''),
            shortName: String(site.shortName || ''),
            lastPublished: site.lastPublished as string | null,
            previewUrl: site.previewUrl as string | null
          }
        })

        // Get collections count for first site (as an example)
        if (sitesData.length > 0) {
          try {
            const collections = await getWebflowCollections(session.user.id, sitesData[0].id)
            collectionsCount = collections.length
          } catch (collectionsError) {
            console.warn('Failed to get collections count:', collectionsError)
          }
        }
      }
    } catch (sitesError) {
      console.warn('Failed to process sites data:', sitesError)
    }

    return NextResponse.json({
      connected: true,
      configValid: true,
      user: connectionTest.user ? {
        id: (connectionTest.user as Record<string, unknown>)._id || (connectionTest.user as Record<string, unknown>).id,
        email: (connectionTest.user as Record<string, unknown>).email,
        firstName: (connectionTest.user as Record<string, unknown>).firstName,
        lastName: (connectionTest.user as Record<string, unknown>).lastName
      } : null,
      tokenStatus: {
        isExpired,
        expiresAt: expiresAt.toISOString(),
        minutesUntilExpiry,
        needsRefresh: minutesUntilExpiry < 5,
        scope: connection.scope
      },
      connection: {
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
        lastTested: new Date().toISOString()
      },
      sites: sitesData,
      stats: {
        sitesCount: sitesData.length,
        collectionsCount: collectionsCount,
        hasContent: sitesData.length > 0 && collectionsCount > 0
      },
      actions: {
        refreshUrl: '/api/webflow/refresh',
        disconnectUrl: '/api/webflow/disconnect',
        syncUrl: '/api/content/sync' // Future content sync endpoint
      }
    })

  } catch (error) {
    console.error('Webflow status check failed:', error)
    
    return NextResponse.json(
      { 
        connected: false,
        configValid: false,
        error: 'Failed to check Webflow status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/webflow/status
 * 
 * Force refresh connection status and test API access
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body for options
    const body = await request.json().catch(() => ({}))
    const { forceRefresh = false } = body

    // If force refresh requested, attempt token refresh first
    if (forceRefresh) {
      try {
        const refreshResponse = await fetch(
          new URL('/api/webflow/refresh', request.url),
          {
            method: 'POST',
            headers: request.headers
          }
        )
        
        if (!refreshResponse.ok) {
          console.warn('Force refresh failed:', await refreshResponse.text())
        }
      } catch (refreshError) {
        console.warn('Force refresh error:', refreshError)
      }
    }

    // Delegate to GET handler for status check
    return GET(request)

  } catch (error) {
    console.error('Webflow status refresh failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to refresh Webflow status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}