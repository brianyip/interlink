import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { 
  getWebflowConnection, 
  refreshAccessToken, 
  storeWebflowConnection,
  validateWebflowConfig 
} from '@/lib/webflow-client'
import { decrypt } from '@/lib/encryption'

/**
 * POST /api/webflow/refresh
 * 
 * Manually refresh Webflow OAuth tokens
 * Useful for testing or force-refreshing expired tokens
 */
export async function POST(request: NextRequest) {
  try {
    // Validate Webflow configuration
    validateWebflowConfig()

    // Check authentication with Better Auth
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get current Webflow connection
    const connection = await getWebflowConnection(session.user.id)
    
    if (!connection) {
      return NextResponse.json(
        { error: 'No Webflow connection found. Please authorize first.' },
        { status: 404 }
      )
    }

    try {
      // Decrypt the refresh token
      const decryptedRefreshToken = decrypt(connection.refreshToken)
      
      // Refresh the access token
      const refreshedTokens = await refreshAccessToken(decryptedRefreshToken)
      
      // Store the new tokens
      await storeWebflowConnection(session.user.id, {
        accessToken: refreshedTokens.accessToken,
        refreshToken: refreshedTokens.refreshToken,
        expiresAt: refreshedTokens.expiresAt,
        scope: connection.scope
      })

      return NextResponse.json({
        success: true,
        message: 'Webflow tokens refreshed successfully',
        expiresAt: refreshedTokens.expiresAt.toISOString()
      })

    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError)
      
      return NextResponse.json(
        { 
          error: 'Failed to refresh Webflow tokens',
          details: refreshError instanceof Error ? refreshError.message : 'Unknown error',
          suggestion: 'You may need to re-authorize your Webflow account'
        },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Webflow refresh endpoint failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/webflow/refresh
 * 
 * Get current token status and expiration info
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

    // Get current Webflow connection
    const connection = await getWebflowConnection(session.user.id)
    
    if (!connection) {
      return NextResponse.json(
        { 
          connected: false,
          message: 'No Webflow connection found'
        }
      )
    }

    const now = new Date()
    const expiresAt = new Date(connection.expiresAt)
    const isExpired = now > expiresAt
    const minutesUntilExpiry = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60)))

    return NextResponse.json({
      connected: true,
      expiresAt: expiresAt.toISOString(),
      isExpired,
      minutesUntilExpiry,
      scope: connection.scope,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
      needsRefresh: minutesUntilExpiry < 5 // Suggest refresh if < 5 minutes left
    })

  } catch (error) {
    console.error('Webflow token status check failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to check token status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}