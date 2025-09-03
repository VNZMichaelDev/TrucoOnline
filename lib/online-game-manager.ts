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
          status: "playing",
        })
        .select()
        .single()

      if (error) throw error

      this.currentRoom = room
      this.statusCallback?.("¡Oponente encontrado! Iniciando partida...")

      // Start listening for game updates
      this.subscribeToGameUpdates()
    } else {
      // No one waiting, join queue
      await this.supabase.from("matchmaking_queue").insert({ player_id: this.currentPlayer.id })

      this.statusCallback?.("Esperando oponente...")

      // Listen for matchmaking updates
      this.subscribeToMatchmaking()
    }
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
          filter: `player2_id=eq.${this.currentPlayer.id}`,
        },
        (payload) => {
          console.log("[v0] Game room created:", payload)
          this.currentRoom = payload.new as GameRoom
          this.statusCallback?.("¡Oponente encontrado! Iniciando partida...")
          this.subscribeToGameUpdates()
        },
      )
      .subscribe()
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

    const { error } = await this.supabase
      .from("game_rooms")
      .update({
        game_state: gameState,
        updated_at: new Date().toISOString(),
      })
      .eq("id", this.currentRoom.id)

    if (error) throw error
  }

  async leaveMatchmaking(): Promise<void> {
    if (!this.currentPlayer) return

    await this.supabase.from("matchmaking_queue").delete().eq("player_id", this.currentPlayer.id)

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

  isPlayerOne(): boolean {
    if (!this.currentRoom || !this.currentPlayer) return false
    return this.currentRoom.player1_id === this.currentPlayer.id
  }

  cleanup() {
    this.supabase.removeAllChannels()
  }
}
