import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getWebflowConnection, testWebflowConnection } from '@/lib/webflow-client'
import { decrypt } from '@/lib/encryption'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Webflow connection
    const connection = await getWebflowConnection(session.user.id)
    
    if (!connection) {
      return NextResponse.json({ 
        error: 'No Webflow connection found',
        debug: {
          userId: session.user.id,
          hasConnection: false
        }
      }, { status: 404 })
    }

    // Decrypt access token
    const decryptedToken = decrypt(connection.accessToken)
    
    // Test SDK connection
    let sdkTest
    try {
      sdkTest = await testWebflowConnection(session.user.id)
    } catch (sdkError) {
      sdkTest = {
        isValid: false,
        error: sdkError instanceof Error ? sdkError.message : 'SDK test failed'
      }
    }
    
    return NextResponse.json({
      userId: session.user.id,
      connection: {
        hasConnection: true,
        expiresAt: connection.expiresAt,
        tokenCreatedAt: connection.tokenCreatedAt,
        scope: connection.scope
      },
      tokenInfo: {
        encryptedLength: connection.accessToken.length,
        decryptedLength: decryptedToken.length,
        startsWithBearer: decryptedToken.startsWith('Bearer'),
        tokenPreview: `${decryptedToken.substring(0, 10)}...${decryptedToken.substring(decryptedToken.length - 10)}`
      },
      sdkTest,
      recommendation: decryptedToken.startsWith('Bearer') 
        ? 'Token has Bearer prefix which SDK adds automatically - this may cause issues' 
        : 'Token format looks correct for SDK usage'
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}