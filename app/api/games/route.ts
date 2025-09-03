import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get("playerId")

    if (!playerId) {
      return NextResponse.json({ error: "Player ID is required" }, { status: 400 })
    }

    // Buscar sala de juego activa para el jugador
    const { data: gameRoom, error } = await supabase
      .from("game_rooms")
      .select("*")
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
      .in("status", ["waiting", "playing"])
      .single()

    if (error && error.code !== "PGRST116") {
      throw error
    }

    return NextResponse.json({ gameRoom })
  } catch (error) {
    console.error("Error fetching game:", error)
    return NextResponse.json({ error: "Error fetching game" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { gameRoomId, gameState } = await request.json()

    if (!gameRoomId || !gameState) {
      return NextResponse.json({ error: "Game room ID and game state are required" }, { status: 400 })
    }

    // Actualizar estado del juego
    const { data: updatedRoom, error } = await supabase
      .from("game_rooms")
      .update({
        status: "playing",
        game_state: gameState,
      })
      .eq("id", gameRoomId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ gameRoom: updatedRoom })
  } catch (error) {
    console.error("Error updating game:", error)
    return NextResponse.json({ error: "Error updating game" }, { status: 500 })
  }
}
