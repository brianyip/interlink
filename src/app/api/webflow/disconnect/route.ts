import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { removeWebflowConnection, getWebflowConnection } from '@/lib/webflow-client'
import { decrypt } from '@/lib/encryption'
import type { WebflowConnection } from '@/lib/types'

/**
 * DELETE /api/webflow/disconnect
 * 
 * Disconnect Webflow account by removing stored OAuth tokens
 * Optionally revoke tokens with Webflow (if supported)
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

    // Get current connection before removing
    const connection = await getWebflowConnection(session.user.id)
    
    if (!connection) {
      return NextResponse.json(
        { 
          success: true,
          message: 'No Webflow connection found to disconnect'
        }
      )
    }

    try {
      // Optional: Revoke tokens with Webflow API (if endpoint exists)
      // Note: Webflow may not have a token revocation endpoint
      // This is a best practice but not always available
      await attemptTokenRevocation(connection)
      
    } catch (revocationError) {
      console.warn('Token revocation failed (may not be supported):', revocationError)
      // Continue with local removal even if revocation fails
    }

    // Remove connection from database
    await removeWebflowConnection(session.user.id)

    return NextResponse.json({
      success: true,
      message: 'Webflow account disconnected successfully'
    })

  } catch (error) {
    console.error('Webflow disconnect failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to disconnect Webflow account',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/webflow/disconnect
 * 
 * Alternative endpoint for form-based disconnection
 */
export async function POST(request: NextRequest) {
  // Delegate to DELETE handler
  return DELETE(request)
}

/**
 * GET /api/webflow/disconnect
 * 
 * Get connection status for disconnect UI
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

    // Get current connection
    const connection = await getWebflowConnection(session.user.id)
    
    return NextResponse.json({
      connected: !!connection,
      connectionInfo: connection ? {
        scope: connection.scope,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
        expiresAt: connection.expiresAt
      } : null
    })

  } catch (error) {
    console.error('Webflow connection status check failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to check connection status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Attempt to revoke tokens with Webflow API
 * This may not be supported by Webflow, but it's good practice to try
 */
async function attemptTokenRevocation(connection: WebflowConnection): Promise<void> {
  try {
    const decryptedAccessToken = decrypt(connection.accessToken)
    
    // Note: Webflow may not have a token revocation endpoint
    // This is a placeholder for standard OAuth 2.0 revocation
    const response = await fetch('https://webflow.com/oauth/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${decryptedAccessToken}`
      },
      body: new URLSearchParams({
        token: decryptedAccessToken,
        token_type_hint: 'access_token'
      })
    })

    if (!response.ok && response.status !== 404) {
      console.warn(`Token revocation returned ${response.status}: ${response.statusText}`)
    }
    
  } catch (error) {
    // Token revocation is optional - don't fail if it's not supported
    console.warn('Token revocation attempt failed:', error)
  }
}