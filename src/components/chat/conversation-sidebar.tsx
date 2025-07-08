"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Search, 
  MessageSquare, 
  Trash2, 
  Edit3,
  MoreVertical,
  Calendar
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ChatConversation } from '@/lib/types'

interface ConversationSidebarProps {
  conversations: ChatConversation[]
  activeConversationId?: string
  onConversationSelect: (conversation: ChatConversation) => void
  onConversationCreate: () => Promise<ChatConversation>
  onConversationDelete: (conversationId: string) => Promise<void>
  onConversationUpdate: (conversationId: string, updates: { title?: string }) => Promise<void>
  className?: string
}

interface ConversationWithCounts extends ChatConversation {
  messageCount?: number
  lastMessageAt?: string
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onConversationSelect,
  onConversationCreate,
  onConversationDelete,
  onConversationUpdate,
  className = ''
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv => 
    conv.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    searchQuery === ''
  )

  // Sort conversations by last activity (most recent first)
  const sortedConversations = filteredConversations.sort((a, b) => {
    const aTime = (a as ConversationWithCounts).lastMessageAt || a.updatedAt
    const bTime = (b as ConversationWithCounts).lastMessageAt || b.updatedAt
    return new Date(bTime).getTime() - new Date(aTime).getTime()
  })

  const handleCreateConversation = async () => {
    setIsCreating(true)
    try {
      const newConversation = await onConversationCreate()
      onConversationSelect(newConversation)
    } catch (error) {
      console.error('Failed to create conversation:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      return
    }

    try {
      await onConversationDelete(conversationId)
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  const handleStartEdit = (conversation: ChatConversation) => {
    setEditingId(conversation.id)
    setEditTitle(conversation.title || 'Untitled Conversation')
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle.trim()) return

    try {
      await onConversationUpdate(editingId, { title: editTitle.trim() })
      setEditingId(null)
      setEditTitle('')
    } catch (error) {
      console.error('Failed to update conversation:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className={`w-80 bg-white border-r border-gray-200 flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Content Chat</h2>
          <Button
            onClick={handleCreateConversation}
            disabled={isCreating}
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {sortedConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchQuery ? (
              <>
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No conversations found</p>
                <p className="text-xs">Try a different search term</p>
              </>
            ) : (
              <>
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs">Start a new chat to get started</p>
              </>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sortedConversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId
              const messageCount = (conversation as ConversationWithCounts).messageCount || 0
              const lastMessageAt = (conversation as ConversationWithCounts).lastMessageAt

              return (
                <Card
                  key={conversation.id}
                  className={`p-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                    isActive ? 'bg-blue-50 border-blue-200' : 'border-gray-200'
                  }`}
                  onClick={() => !editingId && onConversationSelect(conversation)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {editingId === conversation.id ? (
                        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit()
                              if (e.key === 'Escape') handleCancelEdit()
                            }}
                            className="text-sm"
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <Button size="sm" onClick={handleSaveEdit} className="h-6 px-2 text-xs">
                              Save
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancelEdit} className="h-6 px-2 text-xs">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {conversation.title || 'Untitled Conversation'}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">
                              {messageCount} message{messageCount !== 1 ? 's' : ''}
                            </span>
                            {lastMessageAt && (
                              <>
                                <span className="text-xs text-gray-300">•</span>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(lastMessageAt)}
                                </span>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {editingId !== conversation.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStartEdit(conversation)}>
                            <Edit3 className="w-4 h-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteConversation(conversation.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {isActive && (
                    <div className="mt-2">
                      <Badge variant="secondary" className="text-xs">
                        Active
                      </Badge>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
        <p>Content Chat uses AI to help you manage your Webflow content.</p>
      </div>
    </div>
  )
}