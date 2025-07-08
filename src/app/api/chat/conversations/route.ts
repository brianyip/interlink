import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/database'
import type { ChatConversation } from '@/lib/types'

/**
 * POST /api/chat/conversations
 * 
 * Create a new chat conversation
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication with Better Auth
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body for optional conversation title and metadata
    const body = await request.json().catch(() => ({}))
    const { 
      title = null,
      metadata = {}
    } = body

    // Validate title if provided
    if (title && (typeof title !== 'string' || title.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Title must be a non-empty string if provided' },
        { status: 400 }
      )
    }

    // Validate metadata
    if (metadata && typeof metadata !== 'object') {
      return NextResponse.json(
        { error: 'Metadata must be an object if provided' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Insert new conversation
    const insertQuery = `
      INSERT INTO chat_conversations (userId, title, metadata, createdAt, updatedAt)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, userId, title, metadata, createdAt, updatedAt
    `

    const result = await db.query(insertQuery, [
      session.user.id,
      title ? title.trim() : null,
      JSON.stringify(metadata),
      now,
      now
    ])

    if (result.rows.length === 0) {
      throw new Error('Failed to create conversation')
    }

    const conversation: ChatConversation = {
      id: result.rows[0].id,
      userId: result.rows[0].userid,
      title: result.rows[0].title,
      metadata: typeof result.rows[0].metadata === 'string' 
        ? JSON.parse(result.rows[0].metadata) 
        : result.rows[0].metadata,
      createdAt: result.rows[0].createdat,
      updatedAt: result.rows[0].updatedat
    }

    console.log(`Created conversation ${conversation.id} for user ${session.user.id}`)

    return NextResponse.json(conversation, { status: 201 })

  } catch (error) {
    console.error('Failed to create conversation:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to create conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/chat/conversations
 * 
 * List user's chat conversations with pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication with Better Auth
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse query parameters for pagination and filtering
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Max 100 conversations
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)
    const search = searchParams.get('search')?.trim()

    // Build query with optional search
    let baseQuery = `
      SELECT 
        id, 
        userId, 
        title, 
        metadata, 
        createdAt, 
        updatedAt,
        (
          SELECT COUNT(*) 
          FROM chat_messages cm 
          WHERE cm.conversationId = cc.id
        ) as message_count,
        (
          SELECT cm.createdAt 
          FROM chat_messages cm 
          WHERE cm.conversationId = cc.id 
          ORDER BY cm.createdAt DESC 
          LIMIT 1
        ) as last_message_at
      FROM chat_conversations cc
      WHERE userId = $1
    `

    const queryParams: unknown[] = [session.user.id]
    let paramIndex = 2

    // Add search filter if provided
    if (search && search.length > 0) {
      baseQuery += ` AND (title ILIKE $${paramIndex} OR metadata::text ILIKE $${paramIndex})`
      queryParams.push(`%${search}%`)
      paramIndex++
    }

    baseQuery += ` ORDER BY updatedAt DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    queryParams.push(limit, offset)

    // Get conversations
    const conversationsResult = await db.query(baseQuery, queryParams)

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM chat_conversations WHERE userId = $1'
    const countParams: unknown[] = [session.user.id]

    if (search && search.length > 0) {
      countQuery += ' AND (title ILIKE $2 OR metadata::text ILIKE $2)'
      countParams.push(`%${search}%`)
    }

    const countResult = await db.query(countQuery, countParams)
    const totalCount = parseInt(countResult.rows[0].count)

    // Map results to response format
    const conversations: (ChatConversation & { 
      messageCount: number
      lastMessageAt?: string 
    })[] = conversationsResult.rows.map(row => ({
      id: row.id,
      userId: row.userid,
      title: row.title,
      metadata: typeof row.metadata === 'string' 
        ? JSON.parse(row.metadata) 
        : row.metadata,
      createdAt: row.createdat,
      updatedAt: row.updatedat,
      messageCount: parseInt(row.message_count) || 0,
      lastMessageAt: row.last_message_at
    }))

    console.log(`Retrieved ${conversations.length} conversations for user ${session.user.id}`)

    return NextResponse.json({
      conversations,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })

  } catch (error) {
    console.error('Failed to list conversations:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to list conversations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/chat/conversations
 * 
 * Delete all conversations for the authenticated user
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication with Better Auth
    const session = await auth.api.getSession({ headers: request.headers })
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Delete all conversations (and messages due to CASCADE)
    const deleteQuery = 'DELETE FROM chat_conversations WHERE userId = $1'
    const result = await db.query(deleteQuery, [session.user.id])

    console.log(`Deleted all conversations for user ${session.user.id}`)

    return NextResponse.json({
      success: true,
      message: 'All conversations deleted',
      deletedCount: result.rowCount || 0,
      deletedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Failed to delete conversations:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to delete conversations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}