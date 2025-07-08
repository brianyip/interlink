'use client'

import { useWebflowConnection } from '@/hooks/use-webflow-connection'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Globe, 
  Database,
  Loader2,
  RefreshCw,
  ExternalLink,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface WebflowStatusProps {
  /** Show detailed information */
  detailed?: boolean
  /** Custom className */
  className?: string
  /** Show actions (refresh, disconnect) */
  showActions?: boolean
  /** Compact mode for sidebar display */
  compact?: boolean
}

/**
 * Webflow Connection Status Display Component
 * 
 * Shows comprehensive information about the current Webflow connection:
 * - Connection status with visual indicators
 * - User account information
 * - Connected sites and collections
 * - Token status and expiration
 * - Quick actions for management
 */
export function WebflowStatus({ 
  detailed = true, 
  className, 
  showActions = true,
  compact = false 
}: WebflowStatusProps) {
  const {
    connected,
    loading,
    error,
    user,
    sites,
    stats,
    tokenStatus,
    refresh,
    disconnect
  } = useWebflowConnection()

  if (loading && !connected) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="flex items-center justify-center p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Checking Webflow connection...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!connected) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center space-y-2">
            <XCircle className="h-8 w-8 text-red-500 mx-auto" />
            <div className="space-y-1">
              <p className="font-medium">Not Connected to Webflow</p>
              <p className="text-sm text-muted-foreground">
                Connect your Webflow account to sync content
              </p>
              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Compact mode for sidebar
  if (compact) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm font-medium">Webflow</span>
          {getStatusBadge()}
        </div>
        
        {user && (
          <div className="text-xs text-muted-foreground ml-6">
            {user.firstName} {user.lastName}
          </div>
        )}
        
        {stats && stats.hasContent && (
          <div className="text-xs text-muted-foreground ml-6">
            {stats.sitesCount} sites, {stats.collectionsCount} collections
          </div>
        )}
      </div>
    )
  }

  // Full detailed mode
  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          <span>Webflow Connection</span>
          {getStatusBadge()}
        </CardTitle>
        
        {showActions && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="h-8 px-2"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* User Information */}
        {user && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        )}

        {/* Sites and Collections */}
        {stats && (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{stats.sitesCount}</p>
                <p className="text-xs text-muted-foreground">
                  Site{stats.sitesCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Database className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{stats.collectionsCount}</p>
                <p className="text-xs text-muted-foreground">
                  Collection{stats.collectionsCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sites List */}
        {detailed && sites && sites.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Connected Sites</h4>
            <div className="space-y-2">
              {sites.slice(0, 3).map((site) => (
                <div 
                  key={site.id} 
                  className="flex items-center justify-between p-2 rounded border"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{site.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {site.shortName}
                    </p>
                    {site.lastPublished && (
                      <p className="text-xs text-muted-foreground">
                        Published {formatDistanceToNow(new Date(site.lastPublished), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  
                  {site.previewUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => window.open(site.previewUrl!, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
              
              {sites.length > 3 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  +{sites.length - 3} more sites
                </p>
              )}
            </div>
          </div>
        )}

        {/* Token Status */}
        {tokenStatus && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Token Status</h4>
            <div className="flex items-center gap-2 p-2 rounded border">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <p className="text-sm">
                  {tokenStatus.isExpired ? 'Expired' : 
                   tokenStatus.needsRefresh ? 'Expires Soon' : 
                   'Valid'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tokenStatus.isExpired ? 'Reconnection required' :
                   `Expires in ${tokenStatus.minutesUntilExpiry} minutes`}
                </p>
              </div>
              <Badge 
                variant={
                  tokenStatus.isExpired ? 'destructive' : 
                  tokenStatus.needsRefresh ? 'secondary' : 
                  'outline'
                }
                className="text-xs"
              >
                {tokenStatus.isExpired ? 'Expired' : 
                 tokenStatus.needsRefresh ? 'Refresh Soon' : 
                 'Valid'}
              </Badge>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-800">Connection Error</p>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {showActions && (
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3 w-3" />
              )}
              Refresh
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={disconnect}
              disabled={loading}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Disconnect
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )

  function getStatusIcon() {
    if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    if (error || tokenStatus?.isExpired) return <XCircle className="h-4 w-4 text-red-500" />
    if (tokenStatus?.needsRefresh) return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    if (connected) return <CheckCircle className="h-4 w-4 text-green-500" />
    return <XCircle className="h-4 w-4 text-muted-foreground" />
  }

  function getStatusBadge() {
    if (loading) return <Badge variant="secondary">Checking...</Badge>
    if (error) return <Badge variant="destructive">Error</Badge>
    if (tokenStatus?.isExpired) return <Badge variant="destructive">Expired</Badge>
    if (tokenStatus?.needsRefresh) return <Badge variant="secondary">Refresh Soon</Badge>
    if (connected) return <Badge variant="outline" className="text-green-700 border-green-200">Connected</Badge>
    return <Badge variant="secondary">Disconnected</Badge>
  }
}

export default WebflowStatus