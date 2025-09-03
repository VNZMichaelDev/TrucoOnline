import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { playerId } = await request.json()

    if (!playerId) {
      return NextResponse.json({ error: "Player ID is required" }, { status: 400 })
    }

    // Eliminar de la cola de matchmaking
    const { error } = await supabase.from("matchmaking_queue").delete().eq("player_id", playerId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error leaving matchmaking:", error)
    return NextResponse.json({ error: "Error leaving matchmaking" }, { status: 500 })
  }
}
