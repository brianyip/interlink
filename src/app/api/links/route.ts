import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { auth } from "@/lib/auth"
import { LinkCreateInput } from "@/lib/types"

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { rows: links } = await db.query(
      'SELECT * FROM links WHERE "userId" = $1 ORDER BY "createdAt" DESC',
      [session.user.id]
    )

    return NextResponse.json(links)
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body: LinkCreateInput = await request.json()
    
    // Validate required fields
    if (!body.key || !body.displayName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    try {
      const { rows } = await db.query(
        'INSERT INTO links ("userId", key, "displayName", url, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [session.user.id, body.key, body.displayName, body.url || null, body.status || 'active']
      )

      const link = rows[0]
      return NextResponse.json(link, { status: 201 })
    } catch (dbError: any) {
      if (dbError.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: "Link key already exists" }, { status: 409 })
      }
      throw dbError
    }
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}