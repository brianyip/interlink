import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { 
  exchangeCodeForToken, 
  storeWebflowConnection, 
  testWebflowConnection,
  validateWebflowConfig 
} from '@/lib/webflow-client'

/**
 * GET /api/webflow/callback
 * 
 * Handles OAuth callback from Webflow
 * Exchanges authorization code for access token and stores encrypted tokens
 */
export async function GET(request: NextRequest) {
  try {
    // Validate Webflow configuration
    validateWebflowConfig()

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Check for OAuth errors
    if (error) {
      console.error('Webflow OAuth error:', error, errorDescription)
      
      const dashboardUrl = new URL('/dashboard', request.url)
      dashboardUrl.searchParams.set('error', 'webflow_oauth_denied')
      dashboardUrl.searchParams.set('message', errorDescription || 'OAuth authorization denied')
      
      return NextResponse.redirect(dashboardUrl)
    }

    // Validate required parameters
    if (!code) {
      const dashboardUrl = new URL('/dashboard', request.url)
      dashboardUrl.searchParams.set('error', 'webflow_oauth_invalid')
      dashboardUrl.searchParams.set('message', 'Missing authorization code')
      
      return NextResponse.redirect(dashboardUrl)
    }

    // Validate and parse state parameter
    let stateData: { state: string; userId: string; timestamp: number }
    
    if (state) {
      try {
        stateData = JSON.parse(decodeURIComponent(state))
        
        // Check state timestamp (expire after 10 minutes)
        const stateAge = Date.now() - stateData.timestamp
        if (stateAge > 10 * 60 * 1000) {
          throw new Error('State parameter expired')
        }
      } catch (parseError) {
        console.error('Invalid state parameter:', parseError)
        
        const dashboardUrl = new URL('/dashboard', request.url)
        dashboardUrl.searchParams.set('error', 'webflow_oauth_invalid')
        dashboardUrl.searchParams.set('message', 'Invalid or expired state parameter')
        
        return NextResponse.redirect(dashboardUrl)
      }
    }

    // Get current session to verify user
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'session_expired')
      loginUrl.searchParams.set('message', 'Please log in again')
      
      return NextResponse.redirect(loginUrl)
    }

    // Verify state matches current user (if state was provided)
    if (state && stateData!.userId !== session.user.id) {
      console.error('State userId mismatch:', stateData!.userId, 'vs', session.user.id)
      
      const dashboardUrl = new URL('/dashboard', request.url)
      dashboardUrl.searchParams.set('error', 'webflow_oauth_invalid')
      dashboardUrl.searchParams.set('message', 'Invalid authorization state')
      
      return NextResponse.redirect(dashboardUrl)
    }

    try {
      // Exchange authorization code for tokens
      const tokenData = await exchangeCodeForToken(code)
      
      // Store encrypted tokens in database
      await storeWebflowConnection(session.user.id, tokenData)
      
      // Test the connection to ensure it works
      const connectionTest = await testWebflowConnection(session.user.id)
      
      if (!connectionTest.isValid) {
        throw new Error(`Connection test failed: ${connectionTest.error}`)
      }

      // Success - redirect to dashboard with success message
      const dashboardUrl = new URL('/dashboard', request.url)
      dashboardUrl.searchParams.set('success', 'webflow_connected')
      dashboardUrl.searchParams.set('message', 'Webflow account successfully connected')
      
      return NextResponse.redirect(dashboardUrl)

    } catch (tokenError) {
      console.error('Token exchange failed:', tokenError)
      
      const dashboardUrl = new URL('/dashboard', request.url)
      dashboardUrl.searchParams.set('error', 'webflow_token_failed')
      dashboardUrl.searchParams.set('message', 'Failed to complete Webflow authorization')
      
      return NextResponse.redirect(dashboardUrl)
    }

  } catch (error) {
    console.error('Webflow callback handler failed:', error)
    
    const dashboardUrl = new URL('/dashboard', request.url)
    dashboardUrl.searchParams.set('error', 'webflow_callback_failed')
    dashboardUrl.searchParams.set('message', 'Authorization callback failed')
    
    return NextResponse.redirect(dashboardUrl)
  }
}

/**
 * POST /api/webflow/callback
 * 
 * Alternative handler for POST callbacks (some OAuth providers use POST)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    const code = body.get('code') as string
    const state = body.get('state') as string
    const error = body.get('error') as string

    // Create a new URL with query parameters and redirect to GET handler
    const callbackUrl = new URL('/api/webflow/callback', request.url)
    
    if (code) callbackUrl.searchParams.set('code', code)
    if (state) callbackUrl.searchParams.set('state', state)
    if (error) callbackUrl.searchParams.set('error', error)

    return NextResponse.redirect(callbackUrl)

  } catch (error) {
    console.error('POST callback handler failed:', error)
    
    const dashboardUrl = new URL('/dashboard', request.url)
    dashboardUrl.searchParams.set('error', 'webflow_callback_failed')
    dashboardUrl.searchParams.set('message', 'Authorization callback failed')
    
    return NextResponse.redirect(dashboardUrl)
  }
}