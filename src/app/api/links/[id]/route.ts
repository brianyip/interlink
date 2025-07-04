import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { auth } from "@/lib/auth"
import { LinkUpdateInput } from "@/lib/types"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body: LinkUpdateInput = await request.json()
    
    // Build dynamic update query based on provided fields
    const updates: string[] = []
    const values: unknown[] = []
    let paramIndex = 1
    
    if (body.key !== undefined) {
      updates.push(`key = $${paramIndex++}`)
      values.push(body.key)
    }
    if (body.displayName !== undefined) {
      updates.push(`"displayName" = $${paramIndex++}`)
      values.push(body.displayName)
    }
    if (body.url !== undefined) {
      updates.push(`url = $${paramIndex++}`)
      values.push(body.url)
    }
    if (body.status !== undefined) {
      updates.push(`status = $${paramIndex++}`)
      values.push(body.status)
    }
    
    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }
    
    updates.push(`"updatedAt" = NOW()`)
    values.push(params.id, session.user.id)
    
    try {
      const { rows } = await db.query(
        `UPDATE links SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND "userId" = $${paramIndex++} RETURNING *`,
        values
      )
      
      if (rows.length === 0) {
        return NextResponse.json({ error: "Link not found" }, { status: 404 })
      }
      
      const link = rows[0]
      return NextResponse.json(link)
    } catch (dbError: unknown) {
      const errorInfo = dbError as { code?: string }
      if (errorInfo.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: "Link key already exists" }, { status: 409 })
      }
      throw dbError
    }
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { rows } = await db.query(
      'DELETE FROM links WHERE id = $1 AND "userId" = $2 RETURNING id',
      [params.id, session.user.id]
    )
    
    if (rows.length === 0) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Link deleted successfully" })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}