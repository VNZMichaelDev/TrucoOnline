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
  status: "waiting" | "playing" | "finished"
  game_state: GameState | null
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

    // First try to get existing player by user_id
    const { data: existingPlayer } = await this.supabase.from("players").select("*").eq("user_id", userId).single()

    if (existingPlayer) {
      // Update last_seen and username if changed
      const { data: updatedPlayer } = await this.supabase
        .from("players")
        .update({
          last_seen: new Date().toISOString(),
          username: username, // Update username in case it changed
        })
        .eq("id", existingPlayer.id)
        .select()
        .single()

      this.currentPlayer = updatedPlayer
      return updatedPlayer
    }

    // Create new player with user_id
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
    this.autoStartAttempted = false // Reset auto-start flag
    this.statusCallback?.("Buscando oponente...")

    try {
      // Remove from queue if already there
      await this.supabase.from("matchmaking_queue").delete().eq("player_id", this.currentPlayer.id)

      // Check if there's someone waiting
      const { data: waitingPlayers } = await this.supabase
        .from("matchmaking_queue")
        .select("*")
        .neq("player_id", this.currentPlayer.id) // Don't match with ourselves
        .order("created_at", { ascending: true })
        .limit(1)

      if (waitingPlayers && waitingPlayers.length > 0) {
        // Match found! Create game room
        const opponent = waitingPlayers[0]

        // Remove opponent from queue
        await this.supabase.from("matchmaking_queue").delete().eq("id", opponent.id)

        // Create game room
        const { data: room, error } = await this.supabase
          .from("game_rooms")
          .insert({
            player1_id: opponent.player_id,
            player2_id: this.currentPlayer.id,
            status: "waiting",
          })
          .select()
          .single()

        if (error) {
          console.error("[v0] Error creating game room:", error)
          this.isInMatchmaking = false
          throw error
        }

        this.currentRoom = room
        this.hasFoundOpponent = true
        this.statusCallback?.("¡Oponente encontrado! Iniciando partida...")

        // Start listening for game updates
        this.subscribeToGameUpdates()
        this.startGameStatePolling()

        if (this.isPlayerOne()) {
          setTimeout(() => this.attemptAutoStart(), 500)
        }
      } else {
        // No one waiting, join queue
        const { error } = await this.supabase.from("matchmaking_queue").insert({ player_id: this.currentPlayer.id })

        if (error) {
          console.error("[v0] Error joining matchmaking queue:", error)
          this.isInMatchmaking = false
          throw error
        }

        this.statusCallback?.("Esperando oponente...")

        // Listen for matchmaking updates
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
    if (this.autoStartAttempted || this.isGameStarted || !this.currentRoom) return

    this.autoStartAttempted = true
    console.log("[v0] Attempting auto-start as player1")

    try {
      // Create initial game state
      const OnlineTrucoEngine = (await import("@/lib/online-truco-engine")).OnlineTrucoEngine
      // Use "player1" as myPlayerId since this method is only called by player1
      const engine = new OnlineTrucoEngine("Jugador 1", "Jugador 2", "player1")
      const initialState = engine.getSyncableState()

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

    this.matchmakingInterval = setInterval(async () => {
      if (!this.currentPlayer || this.currentRoom || this.hasFoundOpponent || !this.isInMatchmaking) return

      try {
        // Check if we got matched
        const { data: rooms } = await this.supabase
          .from("game_rooms")
          .select("*")
          .or(`player1_id.eq.${this.currentPlayer.id},player2_id.eq.${this.currentPlayer.id}`)
          .eq("status", "waiting")
          .order("created_at", { ascending: false })
          .limit(1)

        if (rooms && rooms.length > 0) {
          console.log("[v0] Found game room via polling:", rooms[0])
          this.currentRoom = rooms[0]
          this.hasFoundOpponent = true
          this.statusCallback?.("¡Oponente encontrado! Iniciando partida...")
          this.subscribeToGameUpdates()
          this.startGameStatePolling()

          // Clear matchmaking polling
          if (this.matchmakingInterval) {
            clearInterval(this.matchmakingInterval)
            this.matchmakingInterval = null
          }

          if (this.isPlayerOne()) {
            setTimeout(() => this.attemptAutoStart(), 500)
          }
        }
      } catch (error) {
        console.error("[v0] Error in matchmaking polling:", error)
      }
    }, 2000) // Reduced interval for faster matching
  }

  private startGameStatePolling() {
    if (this.gameStateInterval) {
      clearInterval(this.gameStateInterval)
    }

    this.gameStateInterval = setInterval(async () => {
      if (!this.currentRoom) return

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

        if (room && room.updated_at !== this.currentRoom.updated_at) {
          console.log("[v0] Game state updated via polling:", room)
          this.currentRoom = room

          if (room.status === "playing" && room.game_state && !this.isGameStarted) {
            console.log("[v0] Game started! Processing initial state")
            this.isGameStarted = true
            this.gameStateCallback?.(room.game_state)
          } else if (room.game_state && this.isGameStarted) {
            console.log("[v0] Received game state update:", room.game_state)
            this.gameStateCallback?.(room.game_state)
          }
        }
      } catch (error) {
        console.error("[v0] Error in game state polling:", error)
      }
    }, 1000) // Faster polling for better responsiveness
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
          game_state: gameState,
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

  async leaveMatchmaking(): Promise<void> {
    if (!this.currentPlayer) return

    this.isInMatchmaking = false
    this.hasFoundOpponent = false
    this.isGameStarted = false

    try {
      await this.supabase.from("matchmaking_queue").delete().eq("player_id", this.currentPlayer.id)
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
          status: "playing",
          game_state: initialGameState,
          updated_at: new Date().toISOString(),
        })
        .eq("id", this.currentRoom.id)

      if (error) {
        console.error("[v0] Error starting game:", error)
        throw error
      }

      this.currentRoom = { ...this.currentRoom, status: "playing", game_state: initialGameState }
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

      return room?.status === "playing" && room?.game_state !== null
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

          if (updatedRoom.game_state) {
            console.log("[v0] Processing game state:", updatedRoom.game_state)
            this.gameStateCallback?.(updatedRoom.game_state)
          }
        },
      )
      .subscribe((status) => {
        console.log("[v0] Game updates subscription status:", status)
      })
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
