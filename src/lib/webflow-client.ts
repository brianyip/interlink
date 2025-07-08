import Webflow from 'webflow-api'
import { encrypt, decrypt } from './encryption'
import { db } from './database'
import { safeParseWebflowExpirationDate } from './date-utils'
import type { 
  WebflowConnection, 
  WebflowCollection, 
  WebflowItem, 
  WebflowApiResponse 
} from './types'

/**
 * Webflow OAuth and API Client
 * 
 * Handles OAuth flow, token management, and API interactions with Webflow CMS
 * Integrates with Better Auth sessions and encrypted token storage
 */


// Environment variables validation
const requiredEnvVars = [
  'WEBFLOW_CLIENT_ID',
  'WEBFLOW_CLIENT_SECRET', 
  'WEBFLOW_REDIRECT_URI'
] as const

export function validateWebflowConfig(): void {
  const missing = requiredEnvVars.filter(key => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required Webflow environment variables: ${missing.join(', ')}`)
  }
}

// OAuth configuration
export const WEBFLOW_CONFIG = {
  clientId: process.env.WEBFLOW_CLIENT_ID!,
  clientSecret: process.env.WEBFLOW_CLIENT_SECRET!,
  redirectUri: process.env.WEBFLOW_REDIRECT_URI!,
  scopes: ['cms:read', 'cms:write', 'sites:read'],
  baseUrl: 'https://api.webflow.com'
} as const

/**
 * Generate OAuth authorization URL for Webflow
 */
export function generateAuthUrl(state?: string): string {
  // Create a temporary Webflow instance for OAuth operations
  const webflow = new Webflow()
  
  return webflow.authorizeUrl({
    client_id: WEBFLOW_CONFIG.clientId,
    redirect_uri: WEBFLOW_CONFIG.redirectUri,
    scope: WEBFLOW_CONFIG.scopes.join(' '),
    state: state || undefined
  })
}

/**
 * Webflow OAuth token response type (based on actual Webflow API)
 */
type WebflowTokenResponse = {
  access_token: string
  token_type: 'bearer'
  expires_in?: number        // seconds from created_at (365 days for Webflow)
  created_at?: number        // epoch seconds
  scope: string
}

/**
 * Exchange authorization code for access token using direct Webflow OAuth endpoint
 * Webflow provides 365-day access tokens without refresh tokens
 */
export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string
  refreshToken: string | null  // Always null for Webflow
  expiresAt: Date
  tokenCreatedAt: Date | null
  scope: string
}> {
  try {
    // Use direct Webflow OAuth endpoint (more reliable than SDK)
    const response = await fetch('https://api.webflow.com/oauth/access_token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: WEBFLOW_CONFIG.clientId,
        client_secret: WEBFLOW_CONFIG.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: WEBFLOW_CONFIG.redirectUri
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Webflow OAuth error response:', response.status, errorText)
      throw new Error(`OAuth token exchange failed (${response.status}): ${errorText}`)
    }

    const tokenData: WebflowTokenResponse = await response.json()
    console.log('Token response structure:', Object.keys(tokenData))
    console.log('Token response (access_token length):', tokenData.access_token?.length || 0)

    // Calculate creation and expiration dates
    const tokenCreatedAt = tokenData.created_at 
      ? new Date(tokenData.created_at * 1000) 
      : new Date() // Fallback to current time
    
    const expiresAt = tokenData.expires_in && tokenData.created_at
      ? new Date((tokenData.created_at + tokenData.expires_in) * 1000)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Default: 365 days from now

    console.log('Token created at:', tokenCreatedAt.toISOString())
    console.log('Token expires at:', expiresAt.toISOString())

    return {
      accessToken: tokenData.access_token,
      refreshToken: null, // Webflow doesn't provide refresh tokens
      expiresAt,
      tokenCreatedAt,
      scope: tokenData.scope
    }
  } catch (error) {
    console.error('Failed to exchange code for token:', error)
    throw new Error('OAuth token exchange failed')
  }
}

// Note: Webflow doesn't support token refresh - tokens are valid for 365 days
// Removed refreshAccessToken function as it's not applicable to Webflow OAuth flow

/**
 * Store Webflow OAuth connection in database with encryption
 * Updated to handle Webflow's 365-day tokens without refresh tokens
 */
export async function storeWebflowConnection(
  userId: string,
  tokenData: {
    accessToken: string
    refreshToken: string | null  // Null for Webflow
    expiresAt: Date
    tokenCreatedAt: Date | null
    scope: string
  }
): Promise<WebflowConnection> {
  try {
    // Encrypt access token
    const encryptedAccessToken = encrypt(tokenData.accessToken)
    
    // Handle refresh token (null for Webflow, but encrypt empty string if somehow provided)
    const encryptedRefreshToken = tokenData.refreshToken 
      ? encrypt(tokenData.refreshToken)
      : null

    console.log('Storing Webflow connection for user:', userId)
    console.log('Token expires at:', tokenData.expiresAt.toISOString())
    console.log('Token created at:', tokenData.tokenCreatedAt?.toISOString() || 'null')

    const { rows } = await db.query(`
      INSERT INTO webflow_connections (
        userid, accesstoken, refreshtoken, expiresat, tokencreatedat, scope, createdat, updatedat
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (userid) 
      DO UPDATE SET 
        accesstoken = EXCLUDED.accesstoken,
        refreshtoken = EXCLUDED.refreshtoken,
        expiresat = EXCLUDED.expiresat,
        tokencreatedat = EXCLUDED.tokencreatedat,
        scope = EXCLUDED.scope,
        updatedat = NOW()
      RETURNING 
        id,
        userid AS "userId",
        accesstoken AS "accessToken",
        refreshtoken AS "refreshToken",
        expiresat AS "expiresAt",
        tokencreatedat AS "tokenCreatedAt",
        scope,
        createdat AS "createdAt",
        updatedat AS "updatedAt"
    `, [
      userId,
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenData.expiresAt,
      tokenData.tokenCreatedAt,
      tokenData.scope
    ])

    console.log('Successfully stored Webflow connection')
    
    // Debug: Log the raw database values returned after insertion
    const storedConnection = rows[0] as WebflowConnection
    console.log('Stored connection raw database values:')
    console.log('  expiresAt:', storedConnection.expiresAt, 'type:', typeof storedConnection.expiresAt)
    console.log('  tokenCreatedAt:', storedConnection.tokenCreatedAt, 'type:', typeof storedConnection.tokenCreatedAt)
    console.log('  createdAt:', storedConnection.createdAt, 'type:', typeof storedConnection.createdAt)
    
    return storedConnection
  } catch (error) {
    console.error('Failed to store Webflow connection:', error)
    throw new Error(`Database operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get Webflow connection for user
 * Webflow uses 365-day tokens without refresh capability
 */
export async function getWebflowConnection(userId: string): Promise<WebflowConnection | null> {
  try {
    const { rows } = await db.query(`
      SELECT 
        id,
        userid AS "userId",
        accesstoken AS "accessToken",
        refreshtoken AS "refreshToken",
        expiresat AS "expiresAt",
        tokencreatedat AS "tokenCreatedAt",
        scope,
        createdat AS "createdAt",
        updatedat AS "updatedAt"
      FROM webflow_connections 
      WHERE userid = $1
    `, [userId])

    if (rows.length === 0) {
      console.log('No Webflow connection found for user:', userId)
      return null
    }

    const connection = rows[0] as WebflowConnection
    console.log('Found Webflow connection for user:', userId)
    
    // Debug: Log the raw database values for troubleshooting
    console.log('Raw database values:')
    console.log('  expiresAt:', connection.expiresAt, 'type:', typeof connection.expiresAt)
    console.log('  tokenCreatedAt:', connection.tokenCreatedAt, 'type:', typeof connection.tokenCreatedAt)
    console.log('  createdAt:', connection.createdAt, 'type:', typeof connection.createdAt)
    
    // Check if token has expired (Webflow tokens are long-lived, 365 days)
    const now = new Date()
    const expiresAt = safeParseWebflowExpirationDate(connection.expiresAt)
    
    if (now > expiresAt) {
      console.log('Webflow token has expired:', expiresAt.toISOString())
      // For expired tokens, still return the connection but let the caller handle re-auth
      // The status endpoint will detect this and prompt for re-authorization
      return connection
    }

    console.log('Webflow token is valid until:', expiresAt.toISOString())
    return connection
    
  } catch (error) {
    console.error('Failed to get Webflow connection:', error)
    return null
  }
}

/**
 * Remove Webflow connection for user
 */
export async function removeWebflowConnection(userId: string): Promise<void> {
  try {
    await db.query(`
      DELETE FROM webflow_connections WHERE userid = $1
    `, [userId])
  } catch (error) {
    console.error('Failed to remove Webflow connection:', error)
    throw new Error('Database operation failed')
  }
}

/**
 * Create authenticated Webflow client for user
 */
export async function createWebflowClient(userId: string): Promise<InstanceType<typeof Webflow> | null> {
  const connection = await getWebflowConnection(userId)
  
  if (!connection) {
    console.log('No connection available for user:', userId)
    return null
  }

  try {
    // Decrypt the access token (handle potential decryption failures gracefully)
    const decryptedAccessToken = decrypt(connection.accessToken)
    
    if (!decryptedAccessToken || decryptedAccessToken.trim() === '') {
      console.error('Decrypted access token is empty for user:', userId)
      return null
    }

    // Debug logging for token (masked for security)
    console.log('Creating Webflow client for user:', userId)
    console.log('Decrypted token length:', decryptedAccessToken.length)
    console.log('Token preview (masked):', `${decryptedAccessToken.substring(0, 10)}...${decryptedAccessToken.substring(decryptedAccessToken.length - 10)}`)
    console.log('Token starts with "Bearer"?:', decryptedAccessToken.startsWith('Bearer'))
    
    // If token starts with "Bearer ", remove it (Webflow SDK doesn't expect it)
    const cleanToken = decryptedAccessToken.startsWith('Bearer ') 
      ? decryptedAccessToken.substring(7) 
      : decryptedAccessToken
    
    if (cleanToken !== decryptedAccessToken) {
      console.log('Removed "Bearer " prefix from token')
      console.log('Clean token length:', cleanToken.length)
    }
    
    // Log the exact parameters being passed to Webflow constructor
    const clientConfig = { token: cleanToken }
    console.log('Webflow client config keys:', Object.keys(clientConfig))
    console.log('Creating Webflow client with v1 API (not beta)')
    
    // Try creating the client - if it fails, we'll catch and log more details
    const client = new Webflow(clientConfig)
    console.log('Webflow client created successfully')
    
    return client
    
  } catch (error) {
    console.error('Failed to create Webflow client for user:', userId, error)
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    // Return null instead of throwing - let callers handle re-auth
    return null
  }
}

/**
 * Test Webflow API connection and get user info
 */
export async function testWebflowConnection(userId: string): Promise<{
  isValid: boolean
  user?: unknown
  sites?: unknown[]
  error?: string
}> {
  try {
    const client = await createWebflowClient(userId)
    
    if (!client) {
      return { isValid: false, error: 'No Webflow connection found' }
    }

    console.log('Testing Webflow connection for user:', userId)
    
    // Test API access by fetching user info first
    let userResponse
    try {
      console.log('Fetching authenticated user...')
      userResponse = await client.authenticatedUser()
      console.log('User response received:', {
        hasUser: !!userResponse?.user,
        userKeys: userResponse?.user ? Object.keys(userResponse.user) : []
      })
    } catch (userError) {
      console.error('Failed to fetch authenticated user:', {
        error: userError,
        message: userError instanceof Error ? userError.message : 'Unknown error',
        response: (userError as any)?.response?.data || (userError as any)?.response || 'No response data'
      })
      
      // If it's a 400 error, log more details
      if ((userError as any)?.response?.status === 400) {
        console.error('400 Bad Request details:', {
          status: (userError as any)?.response?.status,
          statusText: (userError as any)?.response?.statusText,
          data: (userError as any)?.response?.data,
          headers: (userError as any)?.response?.headers
        })
      }
      
      throw userError
    }

    // Then fetch sites
    let sitesResponse
    try {
      console.log('Fetching sites...')
      sitesResponse = await client.sites()
      console.log('Sites response received:', {
        sitesCount: Array.isArray(sitesResponse) ? sitesResponse.length : 'Not an array',
        isArray: Array.isArray(sitesResponse)
      })
    } catch (sitesError) {
      console.error('Failed to fetch sites:', {
        error: sitesError,
        message: sitesError instanceof Error ? sitesError.message : 'Unknown error',
        response: (sitesError as any)?.response?.data || (sitesError as any)?.response || 'No response data'
      })
      
      // If it's a 400 error, log more details
      if ((sitesError as any)?.response?.status === 400) {
        console.error('400 Bad Request details:', {
          status: (sitesError as any)?.response?.status,
          statusText: (sitesError as any)?.response?.statusText,
          data: (sitesError as any)?.response?.data,
          headers: (sitesError as any)?.response?.headers
        })
      }
      
      throw sitesError
    }

    return {
      isValid: true,
      user: userResponse.user,
      sites: sitesResponse
    }
  } catch (error) {
    console.error('Webflow connection test failed:', error)
    console.error('Full error object:', JSON.stringify(error, null, 2))
    
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get Webflow collections for user
 */
export async function getWebflowCollections(
  userId: string, 
  siteId: string
): Promise<WebflowCollection[]> {
  try {
    const client = await createWebflowClient(userId)
    
    if (!client) {
      throw new Error('No Webflow connection found')
    }

    const collections = await client.collections({ siteId })
    return collections || []
  } catch (error) {
    console.error('Failed to get Webflow collections:', error)
    throw new Error('Failed to fetch collections from Webflow')
  }
}

/**
 * Get Webflow collection items with pagination
 */
export async function getWebflowCollectionItems(
  userId: string,
  collectionId: string,
  options: {
    limit?: number
    offset?: number
  } = {}
): Promise<WebflowApiResponse<WebflowItem>> {
  try {
    const client = await createWebflowClient(userId)
    
    if (!client) {
      throw new Error('No Webflow connection found')
    }

    const items = await client.items({
      collectionId,
      limit: options.limit || 100,
      offset: options.offset || 0
    })

    return {
      items: items || [],
      pagination: {
        limit: options.limit || 100,
        offset: options.offset || 0,
        total: items?.length || 0
      }
    }
  } catch (error) {
    console.error('Failed to get Webflow collection items:', error)
    throw new Error('Failed to fetch collection items from Webflow')
  }
}

/**
 * Update Webflow collection item
 */
export async function updateWebflowCollectionItem(
  userId: string,
  collectionId: string,
  itemId: string,
  fieldData: Record<string, unknown>
): Promise<WebflowItem> {
  try {
    const client = await createWebflowClient(userId)
    
    if (!client) {
      throw new Error('No Webflow connection found')
    }

    const updatedItem = await client.updateItem({
      collectionId,
      itemId,
      ...fieldData
    })

    return updatedItem
  } catch (error) {
    console.error('Failed to update Webflow collection item:', error)
    throw new Error('Failed to update collection item in Webflow')
  }
}

/**
 * Debug function to test Webflow API directly with raw HTTP request
 */
export async function testWebflowRawApi(accessToken: string): Promise<{
  success: boolean
  data?: any
  error?: string
  details?: any
}> {
  try {
    console.log('Testing raw Webflow API call')
    console.log('Token length:', accessToken.length)
    console.log('Token preview:', `${accessToken.substring(0, 10)}...${accessToken.substring(accessToken.length - 10)}`)
    
    // Clean token if it has Bearer prefix
    const cleanToken = accessToken.startsWith('Bearer ') 
      ? accessToken.substring(7) 
      : accessToken
    
    // Test with v1 authenticated user endpoint (SDK uses v1)
    console.log('Testing v1 /user endpoint...')
    const v1Response = await fetch('https://api.webflow.com/user', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
    
    console.log('V1 API response status:', v1Response.status)
    console.log('V1 API response headers:', Object.fromEntries(v1Response.headers.entries()))
    
    const v1ResponseText = await v1Response.text()
    console.log('V1 API response body:', v1ResponseText)
    
    let v1ResponseData
    try {
      v1ResponseData = JSON.parse(v1ResponseText)
    } catch {
      v1ResponseData = v1ResponseText
    }
    
    // Also test v2 endpoint for comparison
    console.log('\nTesting v2 /user endpoint...')
    const v2Response = await fetch('https://api.webflow.com/v2/user', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
    
    console.log('V2 API response status:', v2Response.status)
    console.log('V2 API response headers:', Object.fromEntries(v2Response.headers.entries()))
    
    const v2ResponseText = await v2Response.text()
    console.log('V2 API response body:', v2ResponseText)
    
    let v2ResponseData
    try {
      v2ResponseData = JSON.parse(v2ResponseText)
    } catch {
      v2ResponseData = v2ResponseText
    }
    
    const v1Success = v1Response.ok
    const v2Success = v2Response.ok
    
    if (!v1Success && !v2Success) {
      return {
        success: false,
        error: `Both API versions failed - V1: ${v1Response.status}, V2: ${v2Response.status}`,
        details: {
          v1: {
            status: v1Response.status,
            statusText: v1Response.statusText,
            data: v1ResponseData,
            headers: Object.fromEntries(v1Response.headers.entries())
          },
          v2: {
            status: v2Response.status,
            statusText: v2Response.statusText,
            data: v2ResponseData,
            headers: Object.fromEntries(v2Response.headers.entries())
          }
        }
      }
    }
    
    return {
      success: v1Success || v2Success,
      data: {
        v1: v1Success ? v1ResponseData : null,
        v2: v2Success ? v2ResponseData : null
      },
      details: {
        v1: {
          status: v1Response.status,
          success: v1Success,
          headers: Object.fromEntries(v1Response.headers.entries())
        },
        v2: {
          status: v2Response.status,
          success: v2Success,
          headers: Object.fromEntries(v2Response.headers.entries())
        }
      }
    }
  } catch (error) {
    console.error('Raw API test failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }
  }
}

// Export configuration for use in API routes
export { WEBFLOW_CONFIG as config }