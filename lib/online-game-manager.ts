import { createClient } from "@/lib/supabase/client"
import type { GameState, GameAction } from "@/lib/types"

export interface Player {
  id: string
  username: string
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

  async createOrGetPlayer(username: string): Promise<Player> {
    // First try to get existing player
    const { data: existingPlayer } = await this.supabase.from("players").select("*").eq("username", username).single()

    if (existingPlayer) {
      // Update last_seen
      const { data: updatedPlayer } = await this.supabase
        .from("players")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", existingPlayer.id)
        .select()
        .single()

      this.currentPlayer = updatedPlayer
      return updatedPlayer
    }

    // Create new player
    const { data: newPlayer, error } = await this.supabase.from("players").insert({ username }).select().single()

    if (error) throw error

    this.currentPlayer = newPlayer
    return newPlayer
  }

  async joinMatchmaking(): Promise<void> {
    if (!this.currentPlayer) throw new Error("No player set")

    this.statusCallback?.("Buscando oponente...")

    // Remove from queue if already there
    await this.supabase.from("matchmaking_queue").delete().eq("player_id", this.currentPlayer.id)

    // Check if there's someone waiting
    const { data: waitingPlayers } = await this.supabase
      .from("matchmaking_queue")
      .select("*")
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

      if (error) throw error

      this.currentRoom = room
      this.statusCallback?.("¡Oponente encontrado! Iniciando partida...")

      // Start listening for game updates
      this.subscribeToGameUpdates()
      this.startGameStatePolling()
    } else {
      // No one waiting, join queue
      await this.supabase.from("matchmaking_queue").insert({ player_id: this.currentPlayer.id })

      this.statusCallback?.("Esperando oponente...")

      // Listen for matchmaking updates
      this.subscribeToMatchmaking()
      this.startMatchmakingPolling()
    }
  }

  private startMatchmakingPolling() {
    if (this.matchmakingInterval) {
      clearInterval(this.matchmakingInterval)
    }

    this.matchmakingInterval = setInterval(async () => {
      if (!this.currentPlayer || this.currentRoom) return

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
          this.statusCallback?.("¡Oponente encontrado! Iniciando partida...")
          this.subscribeToGameUpdates()
          this.startGameStatePolling()

          // Clear matchmaking polling
          if (this.matchmakingInterval) {
            clearInterval(this.matchmakingInterval)
            this.matchmakingInterval = null
          }
        }
      } catch (error) {
        console.error("[v0] Error in matchmaking polling:", error)
      }
    }, 2000) // Poll every 2 seconds
  }

  private startGameStatePolling() {
    if (this.gameStateInterval) {
      clearInterval(this.gameStateInterval)
    }

    this.gameStateInterval = setInterval(async () => {
      if (!this.currentRoom) return

      try {
        const { data: room } = await this.supabase.from("game_rooms").select("*").eq("id", this.currentRoom.id).single()

        if (room && room.updated_at !== this.currentRoom.updated_at) {
          console.log("[v0] Game state updated via polling:", room)
          this.currentRoom = room

          if (room.game_state) {
            this.gameStateCallback?.(room.game_state)
          }
        }
      } catch (error) {
        console.error("[v0] Error in game state polling:", error)
      }
    }, 1000) // Poll every 1 second during game
  }

  private subscribeToMatchmaking() {
    if (!this.currentPlayer) return

    const channel = this.supabase
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
          this.statusCallback?.("¡Oponente encontrado! Iniciando partida...")
          this.subscribeToGameUpdates()
          this.startGameStatePolling()
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
          this.statusCallback?.("¡Oponente encontrado! Iniciando partida...")
          this.subscribeToGameUpdates()
          this.startGameStatePolling()
        },
      )
      .subscribe()
  }

  async makeMove(action: GameAction): Promise<void> {
    if (!this.currentRoom || !this.currentPlayer) throw new Error("No active game")

    // Record the move
    await this.supabase.from("game_moves").insert({
      room_id: this.currentRoom.id,
      player_id: this.currentPlayer.id,
      move_type: action.type,
      move_data: action,
    })

    // This would typically update the game state
    // For now, we'll let the game engine handle it locally
    // and sync the state
  }

  async updateGameState(gameState: GameState): Promise<void> {
    if (!this.currentRoom) throw new Error("No active game")

    try {
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
      // Just log it and continue
    }
  }

  async leaveMatchmaking(): Promise<void> {
    if (!this.currentPlayer) return

    await this.supabase.from("matchmaking_queue").delete().eq("player_id", this.currentPlayer.id)

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
      console.log("[v0] Waiting for player1 to start the game")
      return
    }

    try {
      const { error } = await this.supabase
        .from("game_rooms")
        .update({
          status: "playing",
          game_state: initialGameState,
          updated_at: new Date().toISOString(),
        })
        .eq("id", this.currentRoom.id)

      if (error) throw error

      this.currentRoom = { ...this.currentRoom, status: "playing", game_state: initialGameState }
      console.log("[v0] Game started successfully by player1")
    } catch (error) {
      console.error("[v0] Failed to start game:", error)
    }
  }

  async isGameReady(): Promise<boolean> {
    if (!this.currentRoom) return false

    const { data: room } = await this.supabase.from("game_rooms").select("*").eq("id", this.currentRoom.id).single()

    return room?.status === "playing" && room?.game_state !== null
  }

  private subscribeToGameUpdates() {
    if (!this.currentRoom) return

    const channel = this.supabase
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
          console.log("[v0] Game state updated:", payload)
          const updatedRoom = payload.new as GameRoom
          this.currentRoom = updatedRoom

          if (updatedRoom.game_state) {
            this.gameStateCallback?.(updatedRoom.game_state)
          }
        },
      )
      .subscribe()
  }

  cleanup() {
    this.supabase.removeAllChannels()
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
