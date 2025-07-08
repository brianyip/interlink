import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/database'
import type { ChatConversation, ChatMessage } from '@/lib/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/chat/conversations/[id]
 * 
 * Get a specific conversation with its messages
 */
export async function GET(request: NextRequest, routeParams: RouteParams) {
  try {
    // Check authentication with Better Auth
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id: conversationId } = await routeParams.params

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    // Parse query parameters for message pagination
    const { searchParams } = new URL(request.url)
    const messageLimit = Math.min(parseInt(searchParams.get('messageLimit') || '50'), 200)
    const messageOffset = Math.max(parseInt(searchParams.get('messageOffset') || '0'), 0)
    const includeMessages = searchParams.get('includeMessages') !== 'false'

    // Get conversation details
    const conversationQuery = `
      SELECT id, userId, title, metadata, createdAt, updatedAt
      FROM chat_conversations 
      WHERE id = $1 AND userId = $2
    `

    const conversationResult = await db.query(conversationQuery, [conversationId, session.user.id])

    if (conversationResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    const conversationRow = conversationResult.rows[0]
    const conversation: ChatConversation = {
      id: conversationRow.id,
      userId: conversationRow.userid,
      title: conversationRow.title,
      metadata: typeof conversationRow.metadata === 'string' 
        ? JSON.parse(conversationRow.metadata) 
        : conversationRow.metadata,
      createdAt: conversationRow.createdat,
      updatedAt: conversationRow.updatedat
    }

    let messages: ChatMessage[] = []
    let messageCount = 0
    let hasMoreMessages = false

    if (includeMessages) {
      // Get messages for this conversation
      const messagesQuery = `
        SELECT id, conversationId, role, content, functionCall, metadata, createdAt
        FROM chat_messages 
        WHERE conversationId = $1
        ORDER BY createdAt ASC
        LIMIT $2 OFFSET $3
      `

      const messagesResult = await db.query(messagesQuery, [conversationId, messageLimit, messageOffset])

      messages = messagesResult.rows.map(row => ({
        id: row.id,
        conversationId: row.conversationid,
        role: row.role as 'user' | 'assistant' | 'system' | 'function',
        content: row.content,
        functionCall: typeof row.functioncall === 'string' 
          ? JSON.parse(row.functioncall) 
          : row.functioncall,
        metadata: typeof row.metadata === 'string' 
          ? JSON.parse(row.metadata) 
          : row.metadata,
        createdAt: row.createdat
      }))

      // Get total message count for pagination
      const messageCountResult = await db.query(
        'SELECT COUNT(*) FROM chat_messages WHERE conversationId = $1',
        [conversationId]
      )
      messageCount = parseInt(messageCountResult.rows[0].count)
      hasMoreMessages = messageOffset + messageLimit < messageCount
    }

    console.log(`Retrieved conversation ${conversationId} with ${messages.length} messages for user ${session.user.id}`)

    return NextResponse.json({
      conversation,
      messages,
      messageCount,
      pagination: includeMessages ? {
        limit: messageLimit,
        offset: messageOffset,
        hasMore: hasMoreMessages
      } : undefined
    })

  } catch (error) {
    console.error('Failed to get conversation:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to get conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/chat/conversations/[id]
 * 
 * Update conversation metadata (title, etc.)
 */
export async function PATCH(request: NextRequest, routeParams: RouteParams) {
  try {
    // Check authentication with Better Auth
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id: conversationId } = await routeParams.params

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    // Parse request body for updates
    const body = await request.json()
    const { title, metadata } = body

    // Validate inputs
    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Title must be a non-empty string if provided' },
        { status: 400 }
      )
    }

    if (metadata !== undefined && typeof metadata !== 'object') {
      return NextResponse.json(
        { error: 'Metadata must be an object if provided' },
        { status: 400 }
      )
    }

    // Check if conversation exists and belongs to user
    const checkQuery = 'SELECT id FROM chat_conversations WHERE id = $1 AND userId = $2'
    const checkResult = await db.query(checkQuery, [conversationId, session.user.id])

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (title !== undefined) {
      updates.push(`title = $${paramIndex}`)
      params.push(title.trim())
      paramIndex++
    }

    if (metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}`)
      params.push(JSON.stringify(metadata))
      paramIndex++
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided for update' },
        { status: 400 }
      )
    }

    // Add updatedAt
    updates.push(`updatedAt = $${paramIndex}`)
    params.push(new Date().toISOString())
    paramIndex++

    // Add WHERE conditions
    const whereParams = [conversationId, session.user.id]

    const updateQuery = `
      UPDATE chat_conversations 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND userId = $${paramIndex + 1}
      RETURNING id, userId, title, metadata, createdAt, updatedAt
    `

    const result = await db.query(updateQuery, [...params, ...whereParams])

    if (result.rows.length === 0) {
      throw new Error('Failed to update conversation')
    }

    const updatedConversation: ChatConversation = {
      id: result.rows[0].id,
      userId: result.rows[0].userid,
      title: result.rows[0].title,
      metadata: typeof result.rows[0].metadata === 'string' 
        ? JSON.parse(result.rows[0].metadata) 
        : result.rows[0].metadata,
      createdAt: result.rows[0].createdat,
      updatedAt: result.rows[0].updatedat
    }

    console.log(`Updated conversation ${conversationId} for user ${session.user.id}`)

    return NextResponse.json(updatedConversation)

  } catch (error) {
    console.error('Failed to update conversation:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to update conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/chat/conversations/[id]
 * 
 * Delete a specific conversation and all its messages
 */
export async function DELETE(request: NextRequest, routeParams: RouteParams) {
  try {
    // Check authentication with Better Auth
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { id: conversationId } = await routeParams.params

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      )
    }

    // Check if conversation exists and belongs to user, get message count
    const checkQuery = `
      SELECT cc.id, COUNT(cm.id) as message_count
      FROM chat_conversations cc
      LEFT JOIN chat_messages cm ON cc.id = cm.conversationId
      WHERE cc.id = $1 AND cc.userId = $2
      GROUP BY cc.id
    `
    
    const checkResult = await db.query(checkQuery, [conversationId, session.user.id])

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    const messageCount = parseInt(checkResult.rows[0].message_count) || 0

    // Delete conversation (messages will be deleted via CASCADE)
    const deleteQuery = 'DELETE FROM chat_conversations WHERE id = $1 AND userId = $2'
    const deleteResult = await db.query(deleteQuery, [conversationId, session.user.id])

    if (deleteResult.rowCount === 0) {
      throw new Error('Failed to delete conversation')
    }

    console.log(`Deleted conversation ${conversationId} with ${messageCount} messages for user ${session.user.id}`)

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted',
      conversationId,
      messagesDeleted: messageCount,
      deletedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to delete conversation:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to delete conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}