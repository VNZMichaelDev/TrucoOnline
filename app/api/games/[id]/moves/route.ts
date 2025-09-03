import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient()
    const gameId = params.id
    const { playerId, moveType, moveData } = await request.json()

    if (!playerId || !moveType) {
      return NextResponse.json({ error: "Player ID and move type are required" }, { status: 400 })
    }

    // Registrar el movimiento
    const { data: move, error: moveError } = await supabase
      .from("game_moves")
      .insert([
        {
          room_id: gameId,
          player_id: playerId,
          move_type: moveType,
          move_data: moveData,
        },
      ])
      .select()
      .single()

    if (moveError) throw moveError

    return NextResponse.json({ move })
  } catch (error) {
    console.error("Error recording move:", error)
    return NextResponse.json({ error: "Error recording move" }, { status: 500 })
  }
}
