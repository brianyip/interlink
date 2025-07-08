import { useState, useEffect, useCallback } from 'react'
import type { WebflowConnectionStatus } from '@/lib/types'

export interface WebflowConnectionState {
  // Connection status
  connected: boolean
  loading: boolean
  error: string | null
  
  // Connection details
  status: WebflowConnectionStatus | null
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
  } | null
  
  // Site and content info
  sites: Array<{
    id: string
    name: string
    shortName: string
    lastPublished: string | null
    previewUrl: string | null
  }>
  stats: {
    sitesCount: number
    collectionsCount: number
    hasContent: boolean
  }
  
  // Token status
  tokenStatus: {
    isExpired: boolean
    expiresAt: string
    minutesUntilExpiry: number
    needsRefresh: boolean
    scope: string
  } | null
  
  // Actions
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  refresh: () => Promise<void>
  checkStatus: () => Promise<void>
}

/**
 * Custom hook to manage Webflow connection state and operations
 * 
 * Features:
 * - Real-time connection status monitoring
 * - Automatic token refresh when needed
 * - OAuth flow management
 * - Error handling and retry logic
 * - Polling for status updates
 */
export function useWebflowConnection(): WebflowConnectionState {
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<WebflowConnectionStatus | null>(null)
  const [user, setUser] = useState<WebflowConnectionState['user']>(null)
  const [sites, setSites] = useState<WebflowConnectionState['sites']>([])
  const [stats, setStats] = useState<WebflowConnectionState['stats']>({
    sitesCount: 0,
    collectionsCount: 0,
    hasContent: false
  })
  const [tokenStatus, setTokenStatus] = useState<WebflowConnectionState['tokenStatus']>(null)

  /**
   * Check current Webflow connection status
   */
  const checkStatus = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/webflow/status', {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to check Webflow connection')
        }
        throw new Error(`Failed to check status: ${response.status}`)
      }

      const data = await response.json()

      // Update all state based on API response
      setConnected(data.connected || false)
      setStatus(data)
      
      if (data.connected) {
        setUser(data.user || null)
        setSites(data.sites || [])
        setStats(data.stats || { sitesCount: 0, collectionsCount: 0, hasContent: false })
        setTokenStatus(data.tokenStatus || null)
        
        // Auto-refresh token if needed
        if (data.tokenStatus?.needsRefresh) {
          console.log('Token needs refresh, attempting automatic refresh...')
          await refreshToken()
        }
      } else {
        // Reset state when not connected
        setUser(null)
        setSites([])
        setStats({ sitesCount: 0, collectionsCount: 0, hasContent: false })
        setTokenStatus(null)
      }

    } catch (err) {
      console.error('Webflow status check failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to check connection status')
      setConnected(false)
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Initiate Webflow OAuth connection flow
   */
  const connect = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/webflow/auth', {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to connect to Webflow')
        }
        throw new Error(`Auth initiation failed: ${response.status}`)
      }

      const data = await response.json()

      if (data.authUrl) {
        // Redirect to Webflow OAuth page
        window.location.href = data.authUrl
      } else {
        throw new Error('No authorization URL received')
      }

    } catch (err) {
      console.error('Webflow connection failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect to Webflow')
      setLoading(false)
    }
  }, [])

  /**
   * Disconnect from Webflow (remove OAuth tokens)
   */
  const disconnect = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/webflow/disconnect', {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to disconnect from Webflow')
        }
        throw new Error(`Disconnect failed: ${response.status}`)
      }

      // Reset all connection state
      setConnected(false)
      setStatus(null)
      setUser(null)
      setSites([])
      setStats({ sitesCount: 0, collectionsCount: 0, hasContent: false })
      setTokenStatus(null)

      console.log('Successfully disconnected from Webflow')

    } catch (err) {
      console.error('Webflow disconnect failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to disconnect from Webflow')
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Refresh Webflow access token
   */
  const refreshToken = useCallback(async () => {
    try {
      const response = await fetch('/api/webflow/refresh', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to refresh Webflow token')
        }
        throw new Error(`Token refresh failed: ${response.status}`)
      }

      console.log('Webflow token refreshed successfully')
      
      // Re-check status to get updated token info
      await checkStatus()

    } catch (err) {
      console.error('Webflow token refresh failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh Webflow token')
      
      // If refresh fails, user likely needs to re-authorize
      if (err instanceof Error && err.message.includes('refresh')) {
        setConnected(false)
        setStatus(null)
      }
    }
  }, [checkStatus])

  /**
   * Force refresh connection status and test API access
   */
  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/webflow/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ forceRefresh: true }),
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`Force refresh failed: ${response.status}`)
      }

      // Update status with fresh data
      await checkStatus()

    } catch (err) {
      console.error('Webflow force refresh failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh connection')
    }
  }, [checkStatus])

  // Check status on mount
  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  // Set up polling for status updates (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      if (connected && !loading) {
        checkStatus()
      }
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [connected, loading, checkStatus])

  // Auto-refresh token when it's about to expire
  useEffect(() => {
    if (tokenStatus?.needsRefresh && connected && !loading) {
      console.log('Auto-refreshing Webflow token...')
      refreshToken()
    }
  }, [tokenStatus?.needsRefresh, connected, loading, refreshToken])

  return {
    connected,
    loading,
    error,
    status,
    user,
    sites,
    stats,
    tokenStatus,
    connect,
    disconnect,
    refresh,
    checkStatus,
  }
}