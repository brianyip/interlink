import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * POST /api/webflow/refresh
 * 
 * Webflow OAuth Note: Webflow provides 365-day access tokens without refresh tokens
 * This endpoint is maintained for API compatibility but returns an informational message
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

    return NextResponse.json({
      success: false,
      message: 'Webflow uses 365-day access tokens that cannot be refreshed',
      explanation: 'Webflow OAuth provides long-lived tokens (365 days) without refresh capability. Re-authorization is only needed when tokens expire or are revoked.',
      action: 'If your token has expired, please use the reconnect flow at /api/webflow/auth',
      tokenLifespan: '365 days from authorization'
    }, { status: 200 }) // Return 200 with explanation instead of error

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
 * Returns information about Webflow's token model
 */
export async function GET() {
  return NextResponse.json({
    tokenModel: 'Webflow 365-day access tokens',
    refreshSupported: false,
    explanation: 'Webflow provides long-lived access tokens (365 days) that do not require or support refresh.',
    reauthorizationRequired: 'Only when tokens expire (after 365 days) or are manually revoked',
    statusEndpoint: '/api/webflow/status',
    reconnectEndpoint: '/api/webflow/auth'
  })
}