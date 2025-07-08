"use client"

import { useState, useEffect, useCallback } from 'react'
import { SidebarLayout } from '@/components/dashboard/sidebar-layout'
import { ChatInterface } from '@/components/chat/chat-interface'
import { ConversationSidebar } from '@/components/chat/conversation-sidebar'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, Zap, Search, FileText } from 'lucide-react'
import { ConnectWebflowButton, useWebflowConnection } from '@/components/webflow'
import type { ChatConversation, ChatMessage } from '@/lib/types'

interface ConversationWithCounts extends ChatConversation {
  messageCount?: number
  lastMessageAt?: string
}

export default function ContentChatPage() {
  const [conversations, setConversations] = useState<ConversationWithCounts[]>([])
  const [activeConversation, setActiveConversation] = useState<ChatConversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { connected: webflowConnected, stats } = useWebflowConnection()

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load messages when active conversation changes
  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation.id)
    } else {
      setMessages([])
    }
  }, [activeConversation])

  const loadConversations = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/chat/conversations')
      
      if (!response.ok) {
        throw new Error(`Failed to load conversations: ${response.status}`)
      }

      const data = await response.json()
      setConversations(data.conversations || [])
      
      // If no active conversation and there are conversations, select the first one
      if (!activeConversation && data.conversations?.length > 0) {
        setActiveConversation(data.conversations[0])
      }
    } catch (err) {
      console.error('Failed to load conversations:', err)
      setError(err instanceof Error ? err.message : 'Failed to load conversations')
    } finally {
      setIsLoading(false)
    }
  }

  const loadMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}?includeMessages=true`)
      
      if (!response.ok) {
        throw new Error(`Failed to load messages: ${response.status}`)
      }

      const data = await response.json()
      setMessages(data.messages || [])
    } catch (err) {
      console.error('Failed to load messages:', err)
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    }
  }

  const handleConversationCreate = async (): Promise<ChatConversation> => {
    try {
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: null, // Will be auto-generated or set by first message
          metadata: {}
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to create conversation: ${response.status}`)
      }

      const newConversation = await response.json()
      
      // Add to conversations list
      setConversations(prev => [newConversation, ...prev])
      
      return newConversation
    } catch (err) {
      console.error('Failed to create conversation:', err)
      throw err
    }
  }

  const handleConversationSelect = (conversation: ChatConversation) => {
    setActiveConversation(conversation)
    setError(null)
  }

  const handleConversationDelete = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`Failed to delete conversation: ${response.status}`)
      }

      // Remove from conversations list
      setConversations(prev => prev.filter(conv => conv.id !== conversationId))
      
      // If this was the active conversation, clear it
      if (activeConversation?.id === conversationId) {
        setActiveConversation(null)
        setMessages([])
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err)
      throw err
    }
  }

  const handleConversationUpdate = async (conversationId: string, updates: { title?: string }) => {
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        throw new Error(`Failed to update conversation: ${response.status}`)
      }

      const updatedConversation = await response.json()
      
      // Update in conversations list
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId ? { ...conv, ...updatedConversation } : conv
        )
      )
      
      // Update active conversation if it's the one being updated
      if (activeConversation?.id === conversationId) {
        setActiveConversation(updatedConversation)
      }
    } catch (err) {
      console.error('Failed to update conversation:', err)
      throw err
    }
  }

  const handleMessagesUpdate = useCallback((newMessages: ChatMessage[]) => {
    setMessages(newMessages)
    
    // Update conversation metadata if needed
    if (activeConversation && newMessages.length > 0) {
      const lastMessage = newMessages[newMessages.length - 1]
      setConversations(prev => 
        prev.map(conv => 
          conv.id === activeConversation.id 
            ? { 
                ...conv, 
                messageCount: newMessages.length,
                lastMessageAt: lastMessage.createdAt,
                updatedAt: new Date().toISOString()
              }
            : conv
        )
      )
    }
  }, [activeConversation])

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-600">Loading conversations...</div>
        </div>
      </SidebarLayout>
    )
  }

  return (
    <SidebarLayout>
      <div className="flex h-full">
        {/* Conversation Sidebar */}
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversation?.id}
          onConversationSelect={handleConversationSelect}
          onConversationCreate={handleConversationCreate}
          onConversationDelete={handleConversationDelete}
          onConversationUpdate={handleConversationUpdate}
        />

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">
                      {activeConversation.title || 'Untitled Conversation'}
                    </h1>
                    <p className="text-sm text-gray-500">
                      AI-powered content assistant for your Webflow CMS
                    </p>
                  </div>
                  <div className="text-xs text-gray-500">
                    {messages.length} message{messages.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              {/* Chat Interface */}
              <div className="flex-1">
                <ChatInterface
                  conversation={activeConversation}
                  initialMessages={messages}
                  onMessagesUpdate={handleMessagesUpdate}
                />
              </div>
            </>
          ) : (
            /* Welcome State */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-md text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-6 text-gray-400" />
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  Welcome to Content Chat
                </h2>
                
                {/* Different messages based on Webflow connection */}
                {webflowConnected ? (
                  <p className="text-gray-600 mb-6">
                    Connected to {stats?.sitesCount || 0} Webflow site{stats?.sitesCount !== 1 ? 's' : ''} with {stats?.collectionsCount || 0} collection{stats?.collectionsCount !== 1 ? 's' : ''}. 
                    Ask questions, find information, and manage your content with AI assistance.
                  </p>
                ) : (
                  <p className="text-gray-600 mb-6">
                    Get instant answers about your Webflow content. Connect your Webflow account to unlock 
                    AI-powered content search, analysis, and bulk editing capabilities.
                  </p>
                )}

                {/* Webflow Connection Card (if not connected) */}
                {!webflowConnected && (
                  <Card className="p-4 mb-6 bg-blue-50 border-blue-200">
                    <div className="text-center space-y-4">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                          1
                        </div>
                        <span className="font-medium text-blue-900">Connect Webflow First</span>
                      </div>
                      <p className="text-sm text-blue-700 mb-4">
                        To use Content Chat, you&apos;ll need to connect your Webflow account to sync your content.
                      </p>
                      <ConnectWebflowButton 
                        variant="default"
                        showStatus={true}
                        onConnectionSuccess={() => {
                          console.log('Webflow connected! Content sync will begin automatically.')
                        }}
                      />
                    </div>
                  </Card>
                )}

                <div className="grid grid-cols-1 gap-4 mb-6">
                  <Card className="p-4 text-left">
                    <div className="flex items-center gap-3 mb-2">
                      <Search className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">Search Content</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      &quot;Find all posts about travel rewards&quot;
                    </p>
                  </Card>

                  <Card className="p-4 text-left">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-5 h-5 text-green-600" />
                      <span className="font-medium">Analyze Content</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      &quot;What card names are mentioned most often?&quot;
                    </p>
                  </Card>

                  <Card className="p-4 text-left">
                    <div className="flex items-center gap-3 mb-2">
                      <Zap className="w-5 h-5 text-purple-600" />
                      <span className="font-medium">Update Content</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      &quot;Replace &apos;Chase Sapphire&apos; with &apos;Chase Sapphire Preferred&apos;&quot;
                    </p>
                  </Card>
                </div>

                <Button 
                  onClick={handleConversationCreate}
                  className="w-full"
                  disabled={!webflowConnected}
                >
                  {webflowConnected ? 'Start Your First Conversation' : 'Connect Webflow to Get Started'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-sm">
          <div className="text-red-800 text-sm">
            {error}
          </div>
        </div>
      )}
    </SidebarLayout>
  )
}