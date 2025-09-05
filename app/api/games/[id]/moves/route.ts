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

    // Verificar el estado del juego y validar turno
    const { data: gameRoom, error: roomError } = await supabase.from("game_rooms").select("*").eq("id", gameId).single()

    if (roomError || !gameRoom) {
      return NextResponse.json({ error: "Game room not found" }, { status: 404 })
    }

    if (gameRoom.status !== "playing") {
      return NextResponse.json({ error: "Game is not in playing state" }, { status: 400 })
    }

    // Validar que es el turno del jugador
    const gameState = gameRoom.game_state as any
    if (gameState) {
      const playerIndex = gameRoom.player1_id === playerId ? 0 : 1
      if (gameState.currentPlayer !== playerIndex) {
        return NextResponse.json({ error: "Not your turn" }, { status: 400 })
      }
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
