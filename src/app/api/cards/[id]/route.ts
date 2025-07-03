import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { auth } from "@/lib/auth"
import { CardUpdateInput } from "@/lib/types"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: new Headers()
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body: CardUpdateInput = await request.json()
    const supabase = await createServerSupabaseClient()
    
    const { data: card, error } = await supabase
      .from("cards")
      .update(body)
      .eq("id", params.id)
      .eq("user_id", session.user.id) // Ensure user can only update their own cards
      .select()
      .single()

    if (error) {
      if (error.code === "23505") { // Unique constraint violation
        return NextResponse.json({ error: "Card key already exists" }, { status: 409 })
      }
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to update card" }, { status: 500 })
    }

    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 })
    }

    return NextResponse.json(card)
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
      headers: new Headers()
    })

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()
    
    const { error } = await supabase
      .from("cards")
      .delete()
      .eq("id", params.id)
      .eq("user_id", session.user.id) // Ensure user can only delete their own cards

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to delete card" }, { status: 500 })
    }

    return NextResponse.json({ message: "Card deleted successfully" })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}