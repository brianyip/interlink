import Webflow from 'webflow-api'
import { encrypt, decrypt } from './encryption'
import { db } from './database'
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
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scope: string
}> {
  try {
    // Create a temporary Webflow instance for OAuth operations
    const webflow = new Webflow()
    
    const tokenResponse = await webflow.accessToken({
      code,
      client_id: WEBFLOW_CONFIG.clientId,
      client_secret: WEBFLOW_CONFIG.clientSecret,
      redirect_uri: WEBFLOW_CONFIG.redirectUri
    })

    // Calculate expiration date (tokens typically expire in 1 hour)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    return {
      accessToken: tokenResponse.access_token,
      refreshToken: '', // webflow-api SDK doesn't expose refresh_token
      expiresAt,
      scope: WEBFLOW_CONFIG.scopes.join(' ')
    }
  } catch (error) {
    console.error('Failed to exchange code for token:', error)
    throw new Error('OAuth token exchange failed')
  }
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date
}> {
  try {
    // Note: Webflow API documentation doesn't clearly specify refresh token endpoint
    // This implementation assumes standard OAuth 2.0 refresh flow
    const response = await fetch(`${WEBFLOW_CONFIG.baseUrl}/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: WEBFLOW_CONFIG.clientId,
        client_secret: WEBFLOW_CONFIG.clientSecret
      })
    })

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`)
    }

    const tokenData = await response.json()
    
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken, // Some providers don't issue new refresh tokens
      expiresAt
    }
  } catch (error) {
    console.error('Failed to refresh access token:', error)
    throw new Error('Token refresh failed')
  }
}

/**
 * Store Webflow OAuth connection in database with encryption
 */
export async function storeWebflowConnection(
  userId: string,
  tokenData: {
    accessToken: string
    refreshToken: string
    expiresAt: Date
    scope: string
  }
): Promise<WebflowConnection> {
  try {
    // Encrypt tokens before storage
    const encryptedAccessToken = encrypt(tokenData.accessToken)
    const encryptedRefreshToken = encrypt(tokenData.refreshToken)

    const { rows } = await db.query(`
      INSERT INTO webflow_connections (
        userId, accessToken, refreshToken, expiresAt, scope, createdAt, updatedAt
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (userId) 
      DO UPDATE SET 
        accessToken = EXCLUDED.accessToken,
        refreshToken = EXCLUDED.refreshToken,
        expiresAt = EXCLUDED.expiresAt,
        scope = EXCLUDED.scope,
        updatedAt = NOW()
      RETURNING *
    `, [
      userId,
      encryptedAccessToken,
      encryptedRefreshToken,
      tokenData.expiresAt,
      tokenData.scope
    ])

    return rows[0] as WebflowConnection
  } catch (error) {
    console.error('Failed to store Webflow connection:', error)
    throw new Error('Database operation failed')
  }
}

/**
 * Get Webflow connection for user with automatic token refresh
 */
export async function getWebflowConnection(userId: string): Promise<WebflowConnection | null> {
  try {
    const { rows } = await db.query(`
      SELECT * FROM webflow_connections 
      WHERE userId = $1
    `, [userId])

    if (rows.length === 0) {
      return null
    }

    const connection = rows[0] as WebflowConnection
    const now = new Date()
    const expiresAt = new Date(connection.expiresAt)

    // Check if token needs refresh (refresh 5 minutes before expiration)
    const refreshThreshold = new Date(expiresAt.getTime() - 5 * 60 * 1000)
    
    if (now > refreshThreshold) {
      try {
        // Decrypt refresh token and refresh access token
        const decryptedRefreshToken = decrypt(connection.refreshToken)
        const refreshedTokens = await refreshAccessToken(decryptedRefreshToken)
        
        // Update database with new tokens
        await storeWebflowConnection(userId, {
          accessToken: refreshedTokens.accessToken,
          refreshToken: refreshedTokens.refreshToken,
          expiresAt: refreshedTokens.expiresAt,
          scope: connection.scope
        })

        // Return updated connection
        const { rows: updatedRows } = await db.query(`
          SELECT * FROM webflow_connections WHERE userId = $1
        `, [userId])
        
        return updatedRows[0] as WebflowConnection
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError)
        // Return expired connection - caller should handle re-authorization
        return connection
      }
    }

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
      DELETE FROM webflow_connections WHERE userId = $1
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
    return null
  }

  try {
    const decryptedAccessToken = decrypt(connection.accessToken)
    return new Webflow({ token: decryptedAccessToken })
  } catch (error) {
    console.error('Failed to create Webflow client:', error)
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

    // Test API access by fetching user info and sites
    const [userResponse, sitesResponse] = await Promise.all([
      client.authenticatedUser(),
      client.sites()
    ])

    return {
      isValid: true,
      user: userResponse.user,
      sites: sitesResponse
    }
  } catch (error) {
    console.error('Webflow connection test failed:', error)
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

// Export configuration for use in API routes
export { WEBFLOW_CONFIG as config }