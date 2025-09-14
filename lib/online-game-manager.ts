import { createClient } from "@/lib/supabase/client"
import type { GameState, GameAction } from "@/lib/types"

export interface Player {
  id: string
  username: string
  user_id: string // Added user_id for authentication linking
  created_at: string
  last_seen: string
  games_played: number
  games_won: number
}

export interface GameRoom {
  id: string
  player1_id: string
  player2_id: string
  status: "waiting" | "active" | "finished"
  current_game_state: GameState | null
  winner_id: string | null
  created_at: string
  updated_at: string
}

export class OnlineGameManager {
  private supabase = createClient()
  private currentPlayer: Player | null = null
  private currentRoom: GameRoom | null = null
  private gameStateCallback: ((gameState: GameState) => void) | null = null
  private statusCallback: ((status: string) => void) | null = null
  private matchmakingInterval: NodeJS.Timeout | null = null
  private gameStateInterval: NodeJS.Timeout | null = null
  private realtimeChannel: any = null
  private isInMatchmaking = false
  private hasFoundOpponent = false
  private isGameStarted = false
  private autoStartAttempted = false // Added flag to prevent multiple auto-start attempts

  async createOrGetPlayer(username: string, userId?: string): Promise<Player> {
    if (!userId) {
      throw new Error("User ID is required for authentication")
    }

    // CORREGIDO: Evitar creación múltiple de jugadores
    if (this.currentPlayer && this.currentPlayer.user_id === userId) {
      console.log("[v0] Player already exists, updating last_seen")
      const { data: updatedPlayer } = await this.supabase
        .from("players")
        .update({
          last_seen: new Date().toISOString(),
          username: username,
        })
        .eq("id", this.currentPlayer.id)
        .select()
        .single()
      
      if (updatedPlayer) {
        this.currentPlayer = updatedPlayer
        return updatedPlayer
      }
    }

    // Buscar jugador existente por user_id
    const { data: existingPlayer, error: selectError } = await this.supabase
      .from("players")
      .select("*")
      .eq("user_id", userId)
      .single()

    if (existingPlayer && !selectError) {
      console.log("[v0] Found existing player:", existingPlayer.username)
      // Actualizar última conexión y nombre si cambió
      const { data: updatedPlayer } = await this.supabase
        .from("players")
        .update({
          last_seen: new Date().toISOString(),
          username: username,
        })
        .eq("id", existingPlayer.id)
        .select()
        .single()

      this.currentPlayer = updatedPlayer || existingPlayer || this.currentPlayer
      return this.currentPlayer
    }

    // CORREGIDO: Crear nuevo jugador solo si no existe
    console.log("[v0] Creating new player:", username)
    const { data: newPlayer, error } = await this.supabase
      .from("players")
      .insert({
        username,
        user_id: userId,
      })
      .select()
      .single()

    if (error) {
      console.error("[v0] Error creating player:", error)
      throw error
    }

    this.currentPlayer = newPlayer
    console.log("[v0] New player created successfully:", newPlayer.id)
    return newPlayer
  }

  async joinMatchmaking(): Promise<void> {
    if (!this.currentPlayer) throw new Error("No player set")

    if (this.isInMatchmaking) {
      console.log("[v0] Already in matchmaking, ignoring duplicate request")
      return
    }

    this.isInMatchmaking = true
    this.hasFoundOpponent = false
    this.isGameStarted = false
    this.autoStartAttempted = false
    this.statusCallback?.("Buscando oponente...")

    try {
      // NUEVO: Limpiar mis salas problemáticas ANTES de buscar
      console.log("[v0] Cleaning up any problematic rooms before matchmaking...")
      await this.cleanupMyRooms()

      // CORREGIDO: Limpiar cola completamente antes de empezar
      await this.supabase.from("matchmaking_queue").delete().eq("player_id", this.currentPlayer.id)
      
      // ELIMINADO: Ya no hay reconexión automática - siempre crear partida nueva
      console.log("[v0] Starting fresh matchmaking - no reconnection")

      // Buscar oponentes en cola
      const { data: waitingPlayers, error: queueError } = await this.supabase
        .from("matchmaking_queue")
        .select("*")
        .neq("player_id", this.currentPlayer.id)
        .order("created_at", { ascending: true })
        .limit(1)

      if (queueError) {
        console.error("[v0] Error fetching waiting players:", queueError)
        throw queueError
      }

      if (waitingPlayers && waitingPlayers.length > 0) {
        // CORREGIDO: Match encontrado - crear sala con transacción
        const opponent = waitingPlayers[0]
        console.log("[v0] Match found with opponent:", opponent.player_id)

        // Eliminar oponente de la cola primero
        const { error: deleteError } = await this.supabase
          .from("matchmaking_queue")
          .delete()
          .eq("id", opponent.id)

        if (deleteError) {
          console.error("[v0] Error removing opponent from queue:", deleteError)
          throw deleteError
        }

        // Crear sala de juego
        const { data: room, error: roomError } = await this.supabase
          .from("game_rooms")
          .insert({
            player1_id: opponent.player_id, // El que estaba esperando es player1
            player2_id: this.currentPlayer.id, // El que se une es player2
            status: "waiting",
          })
          .select()
          .single()

        if (roomError) {
          console.error("[v0] Error creating game room:", roomError)
          // Revertir - volver a poner oponente en cola
          await this.supabase.from("matchmaking_queue").insert({ player_id: opponent.player_id })
          throw roomError
        }

        this.currentRoom = room
        this.hasFoundOpponent = true
        this.statusCallback?.("¡Oponente encontrado! Iniciando partida...")
        
        console.log("[v0] Game room created:", room.id, "- I am player2")

        // Iniciar suscripciones
        this.subscribeToGameUpdates()
        this.startGameStatePolling()

        // Solo player1 puede iniciar el juego
        if (this.isPlayerOne()) {
          setTimeout(() => this.attemptAutoStart(), 1000)
        }
      } else {
        // CORREGIDO: Unirse a cola con verificación
        console.log("[v0] No opponents found, joining queue")
        
        const { error: insertError } = await this.supabase
          .from("matchmaking_queue")
          .insert({ player_id: this.currentPlayer.id })

        if (insertError) {
          console.error("[v0] Error joining matchmaking queue:", insertError)
          this.isInMatchmaking = false
          throw insertError
        }

        this.statusCallback?.("Esperando oponente...")
        console.log("[v0] Successfully joined matchmaking queue")

        // Iniciar polling y suscripciones
        this.subscribeToMatchmaking()
        this.startMatchmakingPolling()
      }
    } catch (error) {
      console.error("[v0] Error in joinMatchmaking:", error)
      this.isInMatchmaking = false
      this.statusCallback?.("Error de conexión. Intenta de nuevo.")
      throw error
    }
  }

  private async attemptAutoStart(): Promise<void> {
    if (this.autoStartAttempted || this.isGameStarted || !this.currentRoom) {
      console.log("[v0] Auto-start skipped:", {
        autoStartAttempted: this.autoStartAttempted,
        isGameStarted: this.isGameStarted,
        hasCurrentRoom: !!this.currentRoom
      })
      return
    }

    this.autoStartAttempted = true
    console.log("[v0] Attempting auto-start as player1")

    try {
      // Verificar que la sala esté en estado correcto
      const { data: currentRoom } = await this.supabase
        .from("game_rooms")
        .select("*")
        .eq("id", this.currentRoom.id)
        .single()

      if (!currentRoom || currentRoom.status !== "waiting") {
        console.log("[v0] Room not in waiting state, cannot auto-start")
        this.autoStartAttempted = false
        return
      }

      // CORREGIDO: Obtener nombres reales de los jugadores
      const player1Name = await this.getPlayerName(this.currentRoom.player1_id)
      const player2Name = await this.getPlayerName(this.currentRoom.player2_id)
      
      console.log("[v0] Creating initial game state with players:", { player1Name, player2Name })
      
      // Create initial game state
      const OnlineTrucoEngine = (await import("@/lib/online-truco-engine")).OnlineTrucoEngine
      // Use "player1" as myPlayerId since this method is only called by player1
      const engine = new OnlineTrucoEngine(player1Name, player2Name, "player1")
      const initialState = engine.getSyncableState()

      console.log("[v0] Starting game with initial state:", initialState)
      await this.startGame(initialState)
    } catch (error) {
      console.error("[v0] Error in auto-start:", error)
      this.autoStartAttempted = false
    }
  }

  private startMatchmakingPolling() {
    if (this.matchmakingInterval) {
      clearInterval(this.matchmakingInterval)
    }

    console.log("[v0] Starting matchmaking polling")
    this.matchmakingInterval = setInterval(async () => {
      if (!this.currentPlayer || this.currentRoom || this.hasFoundOpponent || !this.isInMatchmaking) {
        return
      }

      try {
        // CORREGIDO: Verificar si fuimos emparejados
        const { data: rooms, error } = await this.supabase
          .from("game_rooms")
          .select("*")
          .or(`player1_id.eq.${this.currentPlayer.id},player2_id.eq.${this.currentPlayer.id}`)
          .in("status", ["waiting", "active"])
          .order("created_at", { ascending: false })
          .limit(1)

        if (error) {
          console.error("[v0] Error checking for game rooms:", error)
          return
        }

        if (rooms && rooms.length > 0) {
          const room = rooms[0]
          console.log("[v0] Found game room via polling:", room.id, "Status:", room.status)
          
          this.currentRoom = room
          this.hasFoundOpponent = true
          this.statusCallback?.("¡Oponente encontrado! Iniciando partida...")
          
          // Limpiar polling de matchmaking
          if (this.matchmakingInterval) {
            clearInterval(this.matchmakingInterval)
            this.matchmakingInterval = null
          }
          
          // Eliminar de cola de matchmaking
          await this.supabase.from("matchmaking_queue").delete().eq("player_id", this.currentPlayer.id)
          
          // Iniciar suscripciones de juego
          this.subscribeToGameUpdates()
          this.startGameStatePolling()

          // Solo player1 inicia el juego y solo si está en waiting
          if (this.isPlayerOne() && room.status === "waiting" && !room.current_game_state) {
            console.log("[v0] I am player1, will attempt auto-start in 2 seconds")
            setTimeout(() => this.attemptAutoStart(), 2000)
          } else if (room.status === "active" && room.current_game_state) {
            console.log("[v0] Game already started, processing existing state")
            this.isGameStarted = true
            this.gameStateCallback?.(room.current_game_state)
          } else {
            console.log("[v0] I am player2 or game already started, waiting for updates")
          }
        }
      } catch (error) {
        console.error("[v0] Error in matchmaking polling:", error)
      }
    }, 3000) // CORREGIDO: Intervalo más largo para evitar spam
  }

  private startGameStatePolling() {
    if (this.gameStateInterval) {
      clearInterval(this.gameStateInterval)
    }

    this.gameStateInterval = setInterval(async () => {
      if (!this.currentRoom) {
        console.log("[v0] No current room, stopping game state polling")
        if (this.gameStateInterval) {
          clearInterval(this.gameStateInterval)
          this.gameStateInterval = null
        }
        return
      }

      try {
        const { data: room, error } = await this.supabase
          .from("game_rooms")
          .select("*")
          .eq("id", this.currentRoom.id)
          .single()

        if (error) {
          console.error("[v0] Error fetching room:", error)
          return
        }

        if (room && room.updated_at !== this.currentRoom?.updated_at) {
          console.log("[v0] Game state updated via polling:", {
            roomId: room.id,
            status: room.status,
            hasGameState: !!room.game_state,
            isGameStarted: this.isGameStarted
          })
          
          this.currentRoom = room

          if (room.status === "active" && room.current_game_state && !this.isGameStarted) {
            console.log("[v0] Game started! Processing initial state")
            this.isGameStarted = true
            this.gameStateCallback?.(room.current_game_state)
          } else if (room.current_game_state && this.isGameStarted) {
            console.log("[v0] Received game state update")
            this.gameStateCallback?.(room.current_game_state)
          }
        }
      } catch (error) {
        console.error("[v0] Error in game state polling:", error)
      }
    }, 1500) // Slightly slower polling to reduce load
  }

  private subscribeToMatchmaking() {
    if (!this.currentPlayer) return

    // Clean up existing subscription
    if (this.realtimeChannel) {
      this.supabase.removeChannel(this.realtimeChannel)
    }

    this.realtimeChannel = this.supabase
      .channel("matchmaking")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_rooms",
          filter: `player1_id=eq.${this.currentPlayer.id}`,
        },
        (payload) => {
          console.log("[v0] Game room created (as player1):", payload)
          this.currentRoom = payload.new as GameRoom
          this.hasFoundOpponent = true
          this.statusCallback?.("¡Oponente encontrado! Iniciando partida...")
          this.subscribeToGameUpdates()
          this.startGameStatePolling()

          // Clear matchmaking polling
          if (this.matchmakingInterval) {
            clearInterval(this.matchmakingInterval)
            this.matchmakingInterval = null
          }

          setTimeout(() => this.attemptAutoStart(), 500)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_rooms",
          filter: `player2_id=eq.${this.currentPlayer.id}`,
        },
        (payload) => {
          console.log("[v0] Game room created (as player2):", payload)
          this.currentRoom = payload.new as GameRoom
          this.hasFoundOpponent = true
          this.statusCallback?.("¡Oponente encontrado! Iniciando partida...")
          this.subscribeToGameUpdates()
          this.startGameStatePolling()

          // Clear matchmaking polling
          if (this.matchmakingInterval) {
            clearInterval(this.matchmakingInterval)
            this.matchmakingInterval = null
          }
        },
      )
      .subscribe((status) => {
        console.log("[v0] Matchmaking subscription status:", status)
      })
  }

  async makeMove(action: GameAction): Promise<void> {
    if (!this.currentRoom || !this.currentPlayer) throw new Error("No active game")

    try {
      // Record the move
      const { error } = await this.supabase.from("game_moves").insert({
        room_id: this.currentRoom.id,
        player_id: this.currentPlayer.id,
        move_type: action.type,
        move_data: action,
      })

      if (error) {
        console.error("[v0] Error recording move:", error)
        throw error
      }
    } catch (error) {
      console.error("[v0] Failed to record move:", error)
      // Don't throw here to avoid breaking game flow
    }
  }

  async updateGameState(gameState: GameState): Promise<void> {
    if (!this.currentRoom) throw new Error("No active game")

    try {
      console.log("[v0] Updating game state:", gameState)

      const { error } = await this.supabase
        .from("game_rooms")
        .update({
          current_game_state: gameState,
          updated_at: new Date().toISOString(),
        })
        .eq("id", this.currentRoom.id)

      if (error) {
        console.error("[v0] Error updating game state:", error)
        throw error
      }

      console.log("[v0] Game state updated successfully")
    } catch (error) {
      console.error("[v0] Failed to update game state:", error)
      throw error // Re-throw to handle in calling code
    }
  }

  private async cleanupMyRooms(): Promise<void> {
    if (!this.currentPlayer) return

    try {
      // Limpiar TODAS las salas donde participo que no estén en juego activo
      const { data: myRooms } = await this.supabase
        .from("game_rooms")
        .select("*")
        .or(`player1_id.eq.${this.currentPlayer.id},player2_id.eq.${this.currentPlayer.id}`)
        .neq("status", "finished")

      if (myRooms && myRooms.length > 0) {
        for (const room of myRooms) {
          // Solo eliminar si no hay juego activo o si es una sala waiting/active sin estado válido
          if (room.status === "waiting" || 
              (room.status === "active" && !room.current_game_state) ||
              (room.status === "active" && room.current_game_state && Object.keys(room.current_game_state).length === 0)) {
            console.log("[v0] Cleaning up room:", room.id, "Status:", room.status)
            await this.supabase.from("game_rooms").delete().eq("id", room.id)
          }
        }
      }
    } catch (error) {
      console.error("[v0] Error cleaning up rooms:", error)
    }
  }

  async leaveMatchmaking(): Promise<void> {
    if (!this.currentPlayer) return

    this.isInMatchmaking = false
    this.hasFoundOpponent = false
    this.isGameStarted = false

    try {
      // CORREGIDO: Limpiar cola y salas completamente al salir
      await this.supabase.from("matchmaking_queue").delete().eq("player_id", this.currentPlayer.id)
      await this.cleanupMyRooms()
    } catch (error) {
      console.error("[v0] Error leaving matchmaking:", error)
    }

    if (this.matchmakingInterval) {
      clearInterval(this.matchmakingInterval)
      this.matchmakingInterval = null
    }

    if (this.gameStateInterval) {
      clearInterval(this.gameStateInterval)
      this.gameStateInterval = null
    }

    this.currentRoom = null
    this.statusCallback?.("")
  }

  setGameStateCallback(callback: (gameState: GameState) => void) {
    this.gameStateCallback = callback
  }

  setStatusCallback(callback: (status: string) => void) {
    this.statusCallback = callback
  }

  getCurrentRoom(): GameRoom | null {
    return this.currentRoom
  }

  getCurrentPlayer(): Player | null {
    return this.currentPlayer
  }

  getPlayerId(): string | null {
    return this.currentPlayer?.id || null
  }

  isPlayerOne(): boolean {
    if (!this.currentRoom || !this.currentPlayer) return false
    return this.currentRoom.player1_id === this.currentPlayer.id
  }

  async startGame(initialGameState: GameState): Promise<void> {
    if (!this.currentRoom) throw new Error("No active room")

    if (!this.isPlayerOne()) {
      console.log("[v0] Only player1 can start the game")
      return
    }

    if (this.isGameStarted) {
      console.log("[v0] Game already started, ignoring duplicate request")
      return
    }

    try {
      console.log("[v0] Starting game with initial state:", initialGameState)

      const { error } = await this.supabase
        .from("game_rooms")
        .update({
          status: "active",
          current_game_state: initialGameState,
          updated_at: new Date().toISOString(),
        })
        .eq("id", this.currentRoom.id)

      if (error) {
        console.error("[v0] Error starting game:", error)
        throw error
      }

      this.currentRoom = { ...this.currentRoom, status: "active", current_game_state: initialGameState }
      this.isGameStarted = true
      console.log("[v0] Game started successfully by player1")

      this.gameStateCallback?.(initialGameState)
    } catch (error) {
      console.error("[v0] Failed to start game:", error)
      throw error
    }
  }

  async isGameReady(): Promise<boolean> {
    if (!this.currentRoom) return false

    try {
      const { data: room } = await this.supabase.from("game_rooms").select("*").eq("id", this.currentRoom.id).single()

      return room?.status === "active" && room?.current_game_state !== null
    } catch (error) {
      console.error("[v0] Error checking if game is ready:", error)
      return false
    }
  }

  private subscribeToGameUpdates() {
    if (!this.currentRoom) return

    // Clean up existing subscription
    if (this.realtimeChannel) {
      this.supabase.removeChannel(this.realtimeChannel)
    }

    this.realtimeChannel = this.supabase
      .channel(`game_${this.currentRoom.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_rooms",
          filter: `id=eq.${this.currentRoom.id}`,
        },
        (payload) => {
          console.log("[v0] Received game state update:", payload)
          const updatedRoom = payload.new as GameRoom
          this.currentRoom = updatedRoom

          if (updatedRoom.current_game_state) {
            console.log("[v0] Processing game state:", updatedRoom.current_game_state)
            this.gameStateCallback?.(updatedRoom.current_game_state)
          }
        },
      )
      .subscribe((status) => {
        console.log("[v0] Game updates subscription status:", status)
      })
  }

  // CORREGIDO: Método para obtener nombre real del jugador
  private async getPlayerName(playerId: string): Promise<string> {
    try {
      const { data: player } = await this.supabase
        .from("players")
        .select("username")
        .eq("id", playerId)
        .single()
      
      return player?.username || "Jugador"
    } catch (error) {
      console.error("[v0] Error getting player name:", error)
      return "Jugador"
    }
  }

  // CORREGIDO: Método para obtener información del oponente
  async getOpponentInfo(): Promise<{ id: string, name: string } | null> {
    if (!this.currentRoom || !this.currentPlayer) return null
    
    const opponentId = this.isPlayerOne() ? this.currentRoom.player2_id : this.currentRoom.player1_id
    const opponentName = await this.getPlayerName(opponentId)
    
    return { id: opponentId, name: opponentName }
  }

  cleanup() {
    this.isInMatchmaking = false
    this.hasFoundOpponent = false
    this.isGameStarted = false
    this.autoStartAttempted = false // Reset auto-start flag

    if (this.realtimeChannel) {
      this.supabase.removeChannel(this.realtimeChannel)
      this.realtimeChannel = null
    }

    if (this.matchmakingInterval) {
      clearInterval(this.matchmakingInterval)
      this.matchmakingInterval = null
    }

    if (this.gameStateInterval) {
      clearInterval(this.gameStateInterval)
      this.gameStateInterval = null
    }
  }
}
