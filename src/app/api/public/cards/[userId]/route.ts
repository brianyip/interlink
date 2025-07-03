import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { PublicCard } from "@/lib/types"

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: cards, error } = await supabase
      .from("cards")
      .select("key, display_name, terms_url, status")
      .eq("user_id", params.userId)
      .eq("status", "active")
      .order("key")

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 })
    }

    const publicCards: PublicCard[] = cards?.map(card => ({
      key: card.key,
      display_name: card.display_name,
      terms_url: card.terms_url,
      status: "active" as const
    })) || []

    // Add CORS headers for public access
    const response = NextResponse.json(publicCards)
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

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}