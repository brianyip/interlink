'use client'

import { useState } from 'react'
import { useWebflowConnection } from '@/hooks/use-webflow-connection'
import { ConnectWebflowButton } from './connect-webflow-button'
import { WebflowStatus } from './webflow-status'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { 
  Settings, 
  ExternalLink, 
  Download, 
  Upload, 
  Trash2, 
  AlertTriangle, 
  Info,
  Loader2,
  CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface WebflowSettingsPanelProps {
  /** Custom className */
  className?: string
  /** Show advanced settings */
  showAdvanced?: boolean
}

/**
 * Comprehensive Webflow Settings Panel
 * 
 * Provides a complete management interface for Webflow connections:
 * - Connection status and management
 * - Site and collection information
 * - Sync settings and preferences
 * - Advanced configuration options
 * - Data management and cleanup
 */
export function WebflowSettingsPanel({ 
  className, 
  showAdvanced = true 
}: WebflowSettingsPanelProps) {
  const {
    connected,
    loading,
    error: _error,
    user,
    sites: _sites,
    stats,
    tokenStatus,
    disconnect,
    refresh
  } = useWebflowConnection()

  const [autoSync, setAutoSync] = useState(true)
  const [syncFrequency, setSyncFrequency] = useState('hourly')
  const [syncLoading, setSyncLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  /**
   * Handle manual content sync
   */
  const handleSync = async () => {
    try {
      setSyncLoading(true)
      
      const response = await fetch('/api/content/sync', {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Sync failed')
      }

      const result = await response.json()
      console.log('Content sync completed:', result)
      
      // Refresh connection status to get updated stats
      await refresh()
      
    } catch (err) {
      console.error('Failed to sync content:', err)
    } finally {
      setSyncLoading(false)
    }
  }

  /**
   * Handle data export
   */
  const handleExport = async () => {
    try {
      setExportLoading(true)
      
      // TODO: Implement export functionality
      // This would call an export endpoint to generate CSV/JSON
      console.log('Export functionality not yet implemented')
      
    } catch (err) {
      console.error('Failed to export data:', err)
    } finally {
      setExportLoading(false)
    }
  }

  /**
   * Handle connection disconnect with confirmation
   */
  const handleDisconnectWithConfirm = async () => {
    try {
      await disconnect()
    } catch (err) {
      console.error('Failed to disconnect:', err)
    }
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Connection Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Webflow Connection
          </CardTitle>
          <CardDescription>
            Manage your Webflow account connection and content synchronization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connected ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-blue-800">
                    Connect to Webflow
                  </h3>
                  <p className="text-sm text-blue-700">
                    Connect your Webflow account to enable Content Chat and automatic content synchronization. 
                    You&apos;ll need CMS read/write permissions for your sites.
                  </p>
                  <div className="space-y-1 text-xs text-blue-600">
                    <p>• Access to your Webflow sites and collections</p>
                    <p>• Automatic content synchronization</p>
                    <p>• AI-powered content search and editing</p>
                  </div>
                </div>
              </div>
              
              <ConnectWebflowButton 
                className="w-full"
                showStatus={true}
              />
            </div>
          ) : (
            <WebflowStatus 
              detailed={true}
              showActions={true}
            />
          )}
        </CardContent>
      </Card>

      {/* Content Sync Settings */}
      {connected && (
        <Card>
          <CardHeader>
            <CardTitle>Content Synchronization</CardTitle>
            <CardDescription>
              Configure how your Webflow content is synchronized with Content Chat
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sync Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Content Synced</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.collectionsCount} collections across {stats.sitesCount} sites
                </p>
              </div>
              
              <Button
                onClick={handleSync}
                disabled={syncLoading}
                size="sm"
                variant="outline"
              >
                {syncLoading ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <Download className="mr-2 h-3 w-3" />
                )}
                Sync Now
              </Button>
            </div>

            {/* Auto Sync Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="auto-sync">Automatic Synchronization</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically sync content changes from Webflow
                  </p>
                </div>
                <Switch
                  id="auto-sync"
                  checked={autoSync}
                  onCheckedChange={setAutoSync}
                />
              </div>

              {autoSync && (
                <div className="ml-6 space-y-2">
                  <Label className="text-xs text-muted-foreground">Sync Frequency</Label>
                  <div className="flex gap-2">
                    {[
                      { value: 'hourly', label: 'Hourly' },
                      { value: 'daily', label: 'Daily' },
                      { value: 'manual', label: 'Manual Only' }
                    ].map(option => (
                      <Button
                        key={option.value}
                        variant={syncFrequency === option.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSyncFrequency(option.value)}
                        className="text-xs"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Management */}
      {connected && showAdvanced && (
        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>
              Export, import, and manage your content data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Export Data */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Export Content</h4>
                <p className="text-xs text-muted-foreground">
                  Download your content and embeddings as JSON
                </p>
                <Button
                  onClick={handleExport}
                  disabled={exportLoading}
                  size="sm"
                  variant="outline"
                  className="w-full"
                >
                  {exportLoading ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-3 w-3" />
                  )}
                  Export Data
                </Button>
              </div>

              {/* Import Data */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Import Content</h4>
                <p className="text-xs text-muted-foreground">
                  Import content from backup or another source
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled
                >
                  <Upload className="mr-2 h-3 w-3" />
                  Import Data
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Coming Soon
                  </Badge>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Advanced Settings */}
      {connected && showAdvanced && (
        <Card>
          <CardHeader>
            <CardTitle>Advanced Settings</CardTitle>
            <CardDescription>
              Advanced configuration and troubleshooting options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Connection Details */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Connection Details</h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">User ID:</span>
                  <p className="font-mono">{user?.id}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Scopes:</span>
                  <p className="font-mono">{tokenStatus?.scope}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Quick Actions */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Quick Actions</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open('https://webflow.com/dashboard', '_blank')}
                >
                  <ExternalLink className="mr-2 h-3 w-3" />
                  Open Webflow
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={refresh}
                  disabled={loading}
                >
                  <Download className="mr-2 h-3 w-3" />
                  Refresh Status
                </Button>
              </div>
            </div>

            <Separator />

            {/* Danger Zone */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <h4 className="text-sm font-medium text-red-700">Danger Zone</h4>
              </div>
              
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-red-800">
                    Disconnect Webflow Account
                  </h5>
                  <p className="text-xs text-red-700">
                    This will remove your Webflow connection and stop content synchronization. 
                    Your existing content data will be preserved.
                  </p>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="mt-2"
                      >
                        <Trash2 className="mr-2 h-3 w-3" />
                        Disconnect Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect Webflow Account?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action will remove your Webflow connection and stop automatic content synchronization. 
                          Your existing content data will be preserved, but you won&apos;t be able to sync new changes until you reconnect.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDisconnectWithConfirm}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Disconnect
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default WebflowSettingsPanel