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
      // Crear sala de juego con el primer jugador como creador
      const { data: gameRoom, error: roomError } = await supabase
        .from("game_rooms")
        .insert([
          {
            player1_id: waitingPlayer.player_id, // El que estaba esperando es player1 (empieza primero)
            player2_id: playerId,
            status: "waiting",
            current_game_state: {
              currentPlayer: 0, // Player1 siempre empieza
              phase: "playing",
              players: [
                { id: waitingPlayer.player_id, isBot: false },
                { id: playerId, isBot: false },
              ],
            },
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
        playerIndex: 1, // El jugador que se une es player2
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
        playerIndex: 0, // Será player1 cuando alguien se una
      })
    }
  } catch (error) {
    console.error("Error joining matchmaking:", error)
    return NextResponse.json({ error: "Error joining matchmaking" }, { status: 500 })
  }
}
