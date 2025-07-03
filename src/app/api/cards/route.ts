import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { auth } from "@/lib/auth"
import { CardCreateInput } from "@/lib/types"

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: new Headers()
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()
    
    const { data: cards, error } = await supabase
      .from("cards")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 })
    }

    return NextResponse.json(cards)
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: new Headers()
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body: CardCreateInput = await request.json()
    
    // Validate required fields
    if (!body.key || !body.display_name || !body.terms_url) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    
    const { data: card, error } = await supabase
      .from("cards")
      .insert({
        user_id: session.user.id,
        key: body.key,
        display_name: body.display_name,
        terms_url: body.terms_url,
        status: body.status || "active"
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") { // Unique constraint violation
        return NextResponse.json({ error: "Card key already exists" }, { status: 409 })
      }
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to create card" }, { status: 500 })
    }

    return NextResponse.json(card, { status: 201 })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}