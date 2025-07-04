import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { PublicLink } from "@/lib/types"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const { rows: links } = await db.query(
      'SELECT key, "displayName", url, status FROM links WHERE "userId" = $1 AND status = $2 ORDER BY key',
      [userId, 'active']
    )

    const publicLinks: PublicLink[] = links.map(link => ({
      key: link.key,
      displayName: link.displayName,
      url: link.url,
      status: "active" as const
    }))

    // Add CORS headers for public access
    const response = NextResponse.json(publicLinks)
    response.headers.set("Access-Control-Allow-Origin", "*")
    response.headers.set("Access-Control-Allow-Methods", "GET")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type")
    response.headers.set("Cache-Control", "public, max-age=300") // Cache for 5 minutes

    return response
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}