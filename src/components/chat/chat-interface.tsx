"use client"

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Send, Loader2, Search, FileText, ExternalLink } from 'lucide-react'
import type { ChatMessage, ChatConversation, ContentSearchResult } from '@/lib/types'

interface ChatInterfaceProps {
  conversation: ChatConversation
  initialMessages?: ChatMessage[]
  onMessagesUpdate?: (messages: ChatMessage[]) => void
}

interface StreamEvent {
  type: 'status' | 'search_results' | 'content_delta' | 'message_complete' | 'error' | 'function_call'
  message?: string
  delta?: string
  content?: string
  results?: ContentSearchResult[]
  count?: number
  error?: string
  details?: string
  messageId?: string
  userMessageId?: string
  metadata?: Record<string, unknown>
}

export function ChatInterface({ conversation, initialMessages = [], onMessagesUpdate }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const [searchResults, setSearchResults] = useState<ContentSearchResult[]>([])
  const [status, setStatus] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentResponse])

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)
    setCurrentResponse('')
    setSearchResults([])
    setStatus('')

    // Add user message to UI immediately
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId: conversation.id,
      role: 'user',
      content: userMessage,
      functionCall: null,
      metadata: {},
      createdAt: new Date().toISOString()
    }

    const updatedMessages = [...messages, tempUserMessage]
    setMessages(updatedMessages)
    onMessagesUpdate?.(updatedMessages)

    try {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController()

      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: conversation.id,
          message: userMessage,
          stream: true
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      // Process Server-Sent Events
      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim()
            
            if (data === '[DONE]') {
              setIsLoading(false)
              setStatus('')
              break
            }

            if (data) {
              try {
                const event: StreamEvent = JSON.parse(data)
                
                switch (event.type) {
                  case 'status':
                    setStatus(event.message || '')
                    break
                  
                  case 'search_results':
                    setSearchResults(event.results || [])
                    break
                  
                  case 'content_delta':
                    setCurrentResponse(event.content || '')
                    break
                  
                  case 'message_complete':
                    // Replace temp message with real message data
                    const finalMessages = updatedMessages.map(msg => 
                      msg.id === tempUserMessage.id 
                        ? { ...msg, id: event.userMessageId || msg.id }
                        : msg
                    )
                    
                    // Add assistant message
                    const assistantMessage: ChatMessage = {
                      id: event.messageId || `assistant-${Date.now()}`,
                      conversationId: conversation.id,
                      role: 'assistant',
                      content: event.content || currentResponse,
                      functionCall: null,
                      metadata: event.metadata || {},
                      createdAt: new Date().toISOString()
                    }
                    
                    const allMessages = [...finalMessages, assistantMessage]
                    setMessages(allMessages)
                    onMessagesUpdate?.(allMessages)
                    setCurrentResponse('')
                    break
                  
                  case 'error':
                    console.error('Chat error:', event.error, event.details)
                    setStatus(`Error: ${event.error}`)
                    break
                }
              } catch (parseError) {
                console.error('Failed to parse SSE data:', parseError)
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request aborted')
      } else {
        console.error('Chat request failed:', error)
        setStatus('Failed to send message. Please try again.')
      }
    } finally {
      setIsLoading(false)
      setCurrentResponse('')
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
      setCurrentResponse('')
      setStatus('Request stopped')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        
        {/* Current streaming response */}
        {currentResponse && (
          <div className="flex justify-start">
            <div className="max-w-3xl">
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="text-sm text-gray-900 whitespace-pre-wrap">
                  {currentResponse}
                  <span className="animate-pulse">|</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search Results Display */}
        {searchResults.length > 0 && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                Found {searchResults.length} relevant content pieces
              </span>
            </div>
            <div className="space-y-2">
              {searchResults.slice(0, 3).map((result) => (
                <div key={result.chunkId} className="text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3 h-3 text-blue-600" />
                    <span className="font-medium text-blue-900">{result.title}</span>
                    <Badge variant="secondary" className="text-xs">
                      {(result.similarity * 100).toFixed(0)}% match
                    </Badge>
                  </div>
                  <p className="text-blue-700 ml-5 mt-1">
                    {result.content.substring(0, 100)}...
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Status Display */}
        {status && (
          <div className="flex justify-center">
            <div className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-600 flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              {status}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t bg-white p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your content..."
            disabled={isLoading}
            className="flex-1"
            maxLength={1000}
          />
          {isLoading ? (
            <Button 
              type="button" 
              onClick={handleStop}
              variant="outline"
              size="icon"
            >
              <Loader2 className="w-4 h-4" />
            </Button>
          ) : (
            <Button 
              type="submit" 
              disabled={!input.trim()}
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </form>
        <div className="text-xs text-gray-500 mt-2 text-center">
          AI responses are generated using your Webflow content. Always verify important information.
        </div>
      </div>
    </div>
  )
}

// Message Bubble Component
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  
  // Get search results from metadata if available
  const searchResults = isAssistant && message.metadata?.searchResults as ContentSearchResult[] | undefined

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-3xl ${isUser ? 'bg-blue-600 text-white' : 'bg-gray-100'} rounded-lg p-3`}>
        <div className="text-sm whitespace-pre-wrap">
          {message.content}
        </div>
        
        {/* Show search context for assistant messages */}
        {searchResults && searchResults.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-600 mb-2">
              Sources ({searchResults.length} found):
            </div>
            <div className="space-y-1">
              {searchResults.slice(0, 2).map((result) => (
                <div key={result.chunkId} className="text-xs">
                  <div className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span className="font-medium">{result.title}</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="text-xs opacity-70 mt-2">
          {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}