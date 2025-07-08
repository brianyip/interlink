import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/database'
import { generateEmbedding } from '@/lib/embedding-service'
import OpenAI from 'openai'
import type { 
  ContentSearchResult,
  ChatMessageRequest 
} from '@/lib/types'

// OpenAI client configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// Context management configuration
const CONTEXT_CONFIG = {
  maxTokens: 8000, // 8k token limit from PRD
  maxSearchResults: 10,
  similarityThreshold: 0.7,
  systemPromptTokens: 500 // Estimated tokens for system prompt
} as const

/**
 * POST /api/chat/messages
 * 
 * Send a message and stream the AI response with RAG integration
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  try {
    // Check authentication with Better Auth
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user) {
      return new Response(
        encoder.encode('data: ' + JSON.stringify({ error: 'Authentication required' }) + '\n\n'),
        {
          status: 401,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      )
    }

    // Parse request body
    const body: ChatMessageRequest = await request.json()
    const { conversationId, message } = body

    if (!conversationId || !message?.trim()) {
      return new Response(
        encoder.encode('data: ' + JSON.stringify({ error: 'conversationId and message are required' }) + '\n\n'),
        {
          status: 400,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      )
    }

    // Verify conversation exists and belongs to user
    const conversationCheck = await db.query(
      'SELECT id FROM chat_conversations WHERE id = $1 AND userId = $2',
      [conversationId, session.user.id]
    )

    if (conversationCheck.rows.length === 0) {
      return new Response(
        encoder.encode('data: ' + JSON.stringify({ error: 'Conversation not found' }) + '\n\n'),
        {
          status: 404,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      )
    }

    // Create readable stream for Server-Sent Events
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const startTime = Date.now()
          
          // Send initial status
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({ 
            type: 'status', 
            message: 'Processing request...' 
          }) + '\n\n'))

          // 1. Save user message to database
          const userMessageQuery = `
            INSERT INTO chat_messages (conversationId, role, content, metadata, createdAt)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
          `
          const userMessageResult = await db.query(userMessageQuery, [
            conversationId,
            'user',
            message.trim(),
            JSON.stringify({ timestamp: new Date().toISOString() }),
            new Date().toISOString()
          ])

          const userMessageId = userMessageResult.rows[0].id

          // 2. Perform content search for RAG context
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({ 
            type: 'status', 
            message: 'Searching relevant content...' 
          }) + '\n\n'))

          let searchResults: ContentSearchResult[] = []
          let searchError: string | null = null

          try {
            // Generate embedding for the user message
            const embeddingResult = await generateEmbedding(message.trim())
            
            // Search for relevant content using the hybrid search function
            const searchQuery = `
              SELECT 
                chunk_id as "chunkId",
                content_id as "contentId", 
                content,
                title,
                slug,
                similarity,
                rank
              FROM hybrid_search($1::vector(1536), $2, $3, $4, $5)
            `
            
            const searchDbResult = await db.query(searchQuery, [
              JSON.stringify(embeddingResult.embedding),
              message.trim(),
              session.user.id,
              CONTEXT_CONFIG.maxSearchResults,
              CONTEXT_CONFIG.similarityThreshold
            ])

            searchResults = searchDbResult.rows.map(row => ({
              chunkId: row.chunkId,
              contentId: row.contentId,
              content: row.content,
              title: row.title,
              slug: row.slug,
              similarity: parseFloat(row.similarity),
              rank: parseFloat(row.rank)
            }))

            // Send search results to client
            controller.enqueue(encoder.encode('data: ' + JSON.stringify({ 
              type: 'search_results',
              results: searchResults,
              count: searchResults.length
            }) + '\n\n'))

          } catch (error) {
            console.error('Content search failed:', error)
            searchError = error instanceof Error ? error.message : 'Unknown search error'
            
            controller.enqueue(encoder.encode('data: ' + JSON.stringify({ 
              type: 'search_error',
              error: searchError
            }) + '\n\n'))
          }

          // 3. Get conversation history for context
          const historyQuery = `
            SELECT role, content, createdAt
            FROM chat_messages 
            WHERE conversationId = $1 
            ORDER BY createdAt ASC
            LIMIT 20
          `
          const historyResult = await db.query(historyQuery, [conversationId])
          
          // 4. Build context and messages for OpenAI
          const systemPrompt = buildSystemPrompt(searchResults, searchError)
          const conversationMessages = buildConversationMessages(historyResult.rows, systemPrompt)

          // 5. Stream response from OpenAI
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({ 
            type: 'status', 
            message: 'Generating response...' 
          }) + '\n\n'))

          let assistantResponse = ''
          let tokens = 0

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: conversationMessages,
            max_tokens: 2000,
            temperature: 0.7,
            stream: true,
            tools: [
              {
                type: 'function',
                function: {
                  name: 'search_content',
                  description: 'Search for specific content in the user\'s Webflow CMS',
                  parameters: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: 'The search query to find relevant content'
                      },
                      limit: {
                        type: 'number',
                        description: 'Maximum number of results to return (1-20)',
                        minimum: 1,
                        maximum: 20
                      }
                    },
                    required: ['query']
                  }
                }
              }
            ],
            tool_choice: 'auto'
          })

          // Stream the response
          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta

            if (delta?.content) {
              assistantResponse += delta.content
              tokens++
              
              // Send content chunk to client
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ 
                type: 'content_delta',
                delta: delta.content,
                content: assistantResponse
              }) + '\n\n'))
            }

            if (delta?.tool_calls) {
              // Handle function calls (for future enhancement)
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ 
                type: 'function_call',
                tool_calls: delta.tool_calls
              }) + '\n\n'))
            }

            if (chunk.choices[0]?.finish_reason) {
              // Stream completed
              break
            }
          }

          // 6. Save assistant response to database
          const assistantMessageQuery = `
            INSERT INTO chat_messages (conversationId, role, content, metadata, createdAt)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
          `
          
          const assistantMetadata = {
            searchResults: searchResults.length > 0 ? searchResults : undefined,
            searchError: searchError || undefined,
            tokenCount: tokens,
            executionTime: Date.now() - startTime,
            model: 'gpt-4o'
          }

          const assistantMessageResult = await db.query(assistantMessageQuery, [
            conversationId,
            'assistant',
            assistantResponse,
            JSON.stringify(assistantMetadata),
            new Date().toISOString()
          ])

          // Update conversation timestamp
          await db.query(
            'UPDATE chat_conversations SET updatedAt = $1 WHERE id = $2',
            [new Date().toISOString(), conversationId]
          )

          // Send completion signal
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({ 
            type: 'message_complete',
            messageId: assistantMessageResult.rows[0].id,
            userMessageId,
            content: assistantResponse,
            metadata: assistantMetadata
          }) + '\n\n'))

          // Close the stream
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()

        } catch (error) {
          console.error('Chat completion failed:', error)
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({ 
            type: 'error',
            error: 'Chat completion failed',
            details: errorMessage
          }) + '\n\n'))
          
          controller.close()
        }
      }
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })

  } catch (error) {
    console.error('Message API error:', error)
    
    const errorResponse = JSON.stringify({ 
      type: 'error',
      error: 'Request processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
    
    return new Response(
      encoder.encode('data: ' + errorResponse + '\n\n'),
      {
        status: 500,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    )
  }
}

/**
 * Build system prompt with RAG context
 */
function buildSystemPrompt(searchResults: ContentSearchResult[], searchError: string | null): string {
  const currentDate = new Date().toISOString().split('T')[0]
  
  let systemPrompt = `You are a helpful AI assistant that helps users manage and understand their Webflow content. Today's date is ${currentDate}.

You have access to the user's content through semantic search. When answering questions:
1. Use the provided search results to give accurate, specific answers
2. Always cite your sources by mentioning the content title when referencing information
3. If search results are limited, acknowledge this and offer to search for more specific information
4. Be conversational but professional
5. Focus on helping with content management, editing, and analysis tasks

`

  if (searchError) {
    systemPrompt += `Note: There was an issue with content search: ${searchError}. You can still help the user but won't have access to their latest content.\n\n`
  } else if (searchResults.length > 0) {
    systemPrompt += `Here are the most relevant content pieces from the user's Webflow CMS:\n\n`
    
    searchResults.slice(0, 5).forEach((result, index) => {
      systemPrompt += `${index + 1}. **${result.title}** (${result.slug})\n`
      systemPrompt += `   ${result.content.substring(0, 300)}${result.content.length > 300 ? '...' : ''}\n`
      systemPrompt += `   Relevance: ${(result.similarity * 100).toFixed(1)}%\n\n`
    })
  } else {
    systemPrompt += `No specific content was found related to this query. You can still help with general content management questions or ask the user to be more specific.\n\n`
  }

  return systemPrompt
}

/**
 * Build conversation messages for OpenAI
 */
function buildConversationMessages(historyRows: { role: string; content: string; createdat: string }[], systemPrompt: string): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: systemPrompt
    }
  ]

  // Add conversation history (excluding the current message which is already included)
  historyRows.slice(0, -1).forEach(row => {
    if (row.role === 'user' || row.role === 'assistant') {
      messages.push({
        role: row.role,
        content: row.content || ''
      })
    }
  })

  // Add the current user message (last message in history)
  const lastMessage = historyRows[historyRows.length - 1]
  if (lastMessage && lastMessage.role === 'user') {
    messages.push({
      role: 'user',
      content: lastMessage.content || ''
    })
  }

  return messages
}