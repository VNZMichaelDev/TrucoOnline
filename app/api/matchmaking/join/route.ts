import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { playerId } = await request.json()

    if (!playerId) {
      return NextResponse.json({ error: "Player ID is required" }, { status: 400 })
    }

    // Verificar si el jugador ya está en cola
    const { data: existingQueue } = await supabase
      .from("matchmaking_queue")
      .select("*")
      .eq("player_id", playerId)
      .single()

    if (existingQueue) {
      return NextResponse.json({
        message: "Already in queue",
        queueEntry: existingQueue,
      })
    }

    // Buscar otro jugador en cola
    const { data: waitingPlayer } = await supabase
      .from("matchmaking_queue")
      .select("*")
      .neq("player_id", playerId)
      .limit(1)
      .single()

    if (waitingPlayer) {
      // Crear sala de juego
      const { data: gameRoom, error: roomError } = await supabase
        .from("game_rooms")
        .insert([
          {
            player1_id: waitingPlayer.player_id,
            player2_id: playerId,
            status: "waiting",
          },
        ])
        .select()
        .single()

      if (roomError) throw roomError

      // Eliminar ambos jugadores de la cola
      await supabase.from("matchmaking_queue").delete().in("player_id", [waitingPlayer.player_id, playerId])

      return NextResponse.json({
        matched: true,
        gameRoom,
        opponent: waitingPlayer,
      })
    } else {
      // Agregar a cola de espera
      const { data: queueEntry, error } = await supabase
        .from("matchmaking_queue")
        .insert([{ player_id: playerId }])
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({
        matched: false,
        queueEntry,
      })
    }
  } catch (error) {
    console.error("Error joining matchmaking:", error)
    return NextResponse.json({ error: "Error joining matchmaking" }, { status: 500 })
  }
}
