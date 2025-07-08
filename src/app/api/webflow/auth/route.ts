import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateAuthUrl, validateWebflowConfig } from '@/lib/webflow-client'
import { randomBytes } from 'crypto'

/**
 * GET /api/webflow/auth
 * 
 * Initiates Webflow OAuth flow by redirecting user to Webflow authorization page
 * Requires authenticated session with Better Auth
 */
export async function GET(request: NextRequest) {
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

    // Generate state parameter for CSRF protection
    const randomState = randomBytes(32).toString('hex')
    
    // Create state data with user info and timestamp for verification
    const stateData = JSON.stringify({
      state: randomState,
      userId: session.user.id,
      timestamp: Date.now()
    })

    // Generate auth URL with encoded state data
    const authUrl = generateAuthUrl(stateData)

    // Return redirect URL (client will handle the actual redirect)
    return NextResponse.json({
      authUrl: authUrl,
      state: randomState,
      message: 'Redirect to Webflow for authorization'
    })

  } catch (error) {
    console.error('Webflow auth initiation failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to initiate Webflow authorization',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/webflow/auth
 * 
 * Alternative endpoint that directly redirects to Webflow (for form submissions)
 */
export async function POST(request: NextRequest) {
  try {
    // Validate Webflow configuration
    validateWebflowConfig()

    // Check authentication with Better Auth
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Generate state parameter
    const randomState = randomBytes(32).toString('hex')
    
    const stateData = JSON.stringify({
      state: randomState,
      userId: session.user.id,
      timestamp: Date.now()
    })

    const authUrl = generateAuthUrl(stateData)

    // Direct redirect to Webflow
    return NextResponse.redirect(authUrl)

  } catch (error) {
    console.error('Webflow auth redirect failed:', error)
    
    // Redirect to dashboard with error
    const errorUrl = new URL('/dashboard', request.url)
    errorUrl.searchParams.set('error', 'webflow_auth_failed')
    
    return NextResponse.redirect(errorUrl)
  }
}