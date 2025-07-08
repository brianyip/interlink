'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useWebflowConnection } from '@/hooks/use-webflow-connection'
import { Loader2, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConnectWebflowButtonProps {
  /** Button variant */
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link'
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  /** Custom className */
  className?: string
  /** Show detailed status text */
  showStatus?: boolean
  /** Callback after successful connection */
  onConnectionSuccess?: () => void
  /** Callback after disconnection */
  onDisconnection?: () => void
  /** Custom button text when disconnected */
  disconnectedText?: string
  /** Custom button text when connected */
  connectedText?: string
}

/**
 * Connect Webflow Button Component
 * 
 * A smart button that adapts based on Webflow connection status:
 * - Shows "Connect to Webflow" when disconnected
 * - Shows connection status and manage options when connected
 * - Handles OAuth flow initiation
 * - Provides visual feedback for different states
 */
export function ConnectWebflowButton({
  variant = 'default',
  size = 'default',
  className,
  showStatus = false,
  onConnectionSuccess: _onConnectionSuccess,
  onDisconnection,
  disconnectedText = 'Connect to Webflow',
  connectedText = 'Connected to Webflow'
}: ConnectWebflowButtonProps) {
  const {
    connected,
    loading,
    error,
    user,
    stats,
    tokenStatus,
    connect,
    disconnect,
    refresh
  } = useWebflowConnection()

  const [actionLoading, setActionLoading] = useState(false)

  /**
   * Handle connection button click
   */
  const handleConnect = async () => {
    if (connected) {
      // If connected, show manage options (could be dropdown or redirect)
      return
    }

    try {
      setActionLoading(true)
      await connect()
      // Note: connect() redirects to Webflow OAuth, so onConnectionSuccess 
      // will be called after user returns from callback
    } catch (err) {
      console.error('Failed to initiate Webflow connection:', err)
      setActionLoading(false)
    }
  }

  /**
   * Handle disconnect button click
   */
  const handleDisconnect = async () => {
    try {
      setActionLoading(true)
      await disconnect()
      onDisconnection?.()
    } catch (err) {
      console.error('Failed to disconnect from Webflow:', err)
    } finally {
      setActionLoading(false)
    }
  }

  /**
   * Handle refresh button click
   */
  const handleRefresh = async () => {
    try {
      setActionLoading(true)
      await refresh()
    } catch (err) {
      console.error('Failed to refresh Webflow connection:', err)
    } finally {
      setActionLoading(false)
    }
  }

  // Determine button state and appearance
  const isLoading = loading || actionLoading
  const hasError = !!error
  const isTokenExpired = tokenStatus?.isExpired
  const needsRefresh = tokenStatus?.needsRefresh

  // Button text based on state
  const getButtonText = () => {
    if (isLoading) return 'Connecting...'
    if (hasError) return 'Connection Error'
    if (connected) {
      if (isTokenExpired) return 'Reconnect to Webflow'
      if (needsRefresh) return 'Refreshing...'
      return connectedText
    }
    return disconnectedText
  }

  // Button icon based on state
  const getButtonIcon = () => {
    if (isLoading) return <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    if (hasError || isTokenExpired) return <AlertCircle className="mr-2 h-4 w-4" />
    if (connected) return <CheckCircle className="mr-2 h-4 w-4" />
    return <ExternalLink className="mr-2 h-4 w-4" />
  }

  // Button variant based on state
  const getButtonVariant = () => {
    if (hasError || isTokenExpired) return 'destructive'
    if (connected && !needsRefresh) return 'outline'
    return variant
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Button
        variant={getButtonVariant()}
        size={size}
        onClick={handleConnect}
        disabled={isLoading}
        className={cn(
          'transition-all duration-200',
          connected && !isTokenExpired && !needsRefresh && 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
          hasError && 'animate-pulse'
        )}
      >
        {getButtonIcon()}
        {getButtonText()}
      </Button>

      {/* Status Information */}
      {showStatus && (
        <div className="space-y-1 text-sm">
          {/* Connection Status */}
          {connected && user && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-3 w-3" />
              <span>Connected as {user.firstName} {user.lastName}</span>
            </div>
          )}

          {/* Site Information */}
          {connected && stats && (
            <div className="text-muted-foreground">
              {stats.sitesCount} site{stats.sitesCount !== 1 ? 's' : ''}, {stats.collectionsCount} collection{stats.collectionsCount !== 1 ? 's' : ''}
            </div>
          )}

          {/* Token Status */}
          {connected && tokenStatus && (
            <div className={cn(
              'text-xs',
              tokenStatus.isExpired ? 'text-red-600' : 
              tokenStatus.needsRefresh ? 'text-yellow-600' : 
              'text-muted-foreground'
            )}>
              {tokenStatus.isExpired ? 'Token expired - reconnection required' :
               tokenStatus.needsRefresh ? `Token expires in ${tokenStatus.minutesUntilExpiry} minutes` :
               `Token valid for ${tokenStatus.minutesUntilExpiry} minutes`}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-xs">
              <AlertCircle className="h-3 w-3" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons for Connected State */}
          {connected && !isTokenExpired && (
            <div className="flex gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
                className="h-7 px-2 text-xs"
              >
                {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={isLoading}
                className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Disconnect
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ConnectWebflowButton