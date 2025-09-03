import { createClient } from "@/lib/supabase/client"
import type { GameState, GameAction } from "@/lib/types"
import { TrucoEngine } from "@/lib/truco-engine"

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
  status: "waiting" | "active" | "finished"
  current_game_state: GameState | null
  winner_id: string | null
  created_at: string
  updated_at: string
}

export interface GameMove {
  id: string
  room_id: string
  player_id: string
  move_type: string
  move_data: any
  created_at: string
}

export class RealtimeGameManager {
  private supabase = createClient()
  private currentPlayer: Player | null = null
  private currentRoom: GameRoom | null = null
  private gameEngine: TrucoEngine | null = null
  private onGameStateChange?: (state: GameState) => void
  private onPlayerJoined?: (player: Player) => void
  private onPlayerLeft?: () => void
  private onError?: (error: string) => void
  private matchmakingActive = false

  async setCurrentUsername(username: string) {
    await this.supabase.rpc("set_config", {
      setting_name: "app.current_username",
      setting_value: username,
      is_local: false,
    })
  }

  async createOrGetPlayer(username: string): Promise<Player> {
    // Set username for RLS
    await this.setCurrentUsername(username)

    // Try to get existing player
    const { data: existingPlayer } = await this.supabase.from("players").select("*").eq("username", username).single()

    if (existingPlayer) {
      // Update last_seen
      const { data: updatedPlayer } = await this.supabase
        .from("players")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", existingPlayer.id)
        .select()
        .single()

      this.currentPlayer = updatedPlayer || existingPlayer
      return this.currentPlayer
    }

    // Create new player
    const { data: newPlayer, error } = await this.supabase.from("players").insert({ username }).select().single()

    if (error) throw error

    this.currentPlayer = newPlayer
    return newPlayer
  }

  async joinMatchmaking(): Promise<void> {
    if (!this.currentPlayer) throw new Error("No current player")

    // Remove any existing queue entries for this player
    await this.supabase.from("matchmaking_queue").delete().eq("player_id", this.currentPlayer.id)

    // Add to queue
    const { error } = await this.supabase.from("matchmaking_queue").insert({ player_id: this.currentPlayer.id })

    if (error) throw error

    // Start looking for matches
    this.startMatchmaking()
  }

  async findMatch(username: string): Promise<{ opponentName: string; gameId: string } | null> {
    try {
      // Create or get player
      await this.createOrGetPlayer(username)

      // Join matchmaking
      await this.joinMatchmaking()

      // Wait for match (simulate for now, but this would be real-time)
      return new Promise((resolve) => {
        const checkMatch = async () => {
          if (!this.matchmakingActive) {
            resolve(null)
            return
          }

          // Check if we have a room
          if (this.currentRoom) {
            // Get opponent info
            const opponentId =
              this.currentRoom.player1_id === this.currentPlayer?.id
                ? this.currentRoom.player2_id
                : this.currentRoom.player1_id

            const { data: opponent } = await this.supabase
              .from("players")
              .select("username")
              .eq("id", opponentId)
              .single()

            resolve({
              opponentName: opponent?.username || "Oponente",
              gameId: this.currentRoom.id,
            })
          } else {
            // Keep checking
            setTimeout(checkMatch, 1000)
          }
        }

        this.matchmakingActive = true
        checkMatch()
      })
    } catch (error) {
      console.error("Error in findMatch:", error)
      return null
    }
  }

  async cancelMatchmaking(): Promise<void> {
    this.matchmakingActive = false

    if (this.currentPlayer) {
      await this.supabase.from("matchmaking_queue").delete().eq("player_id", this.currentPlayer.id)
    }
  }

  async getOnlinePlayersCount(): Promise<number> {
    const { count } = await this.supabase
      .from("players")
      .select("*", { count: "exact", head: true })
      .gte("last_seen", new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes

    return count || 0
  }

  private async startMatchmaking() {
    const checkForMatch = async () => {
      if (!this.currentPlayer || !this.matchmakingActive) return

      // Get all players in queue (excluding current player)
      const { data: queuedPlayers } = await this.supabase
        .from("matchmaking_queue")
        .select(`
          *,
          players:player_id (*)
        `)
        .neq("player_id", this.currentPlayer.id)
        .order("created_at", { ascending: true })
        .limit(1)

      if (queuedPlayers && queuedPlayers.length > 0) {
        const opponent = queuedPlayers[0]
        await this.createGameRoom(opponent.player_id)
      } else {
        // Keep checking every 2 seconds
        if (this.matchmakingActive) {
          setTimeout(checkForMatch, 2000)
        }
      }
    }

    checkForMatch()
  }

  private async createGameRoom(opponentId: string) {
    if (!this.currentPlayer) return

    // Remove both players from queue
    await this.supabase.from("matchmaking_queue").delete().in("player_id", [this.currentPlayer.id, opponentId])

    // Create new game room
    const { data: room, error } = await this.supabase
      .from("game_rooms")
      .insert({
        player1_id: this.currentPlayer.id,
        player2_id: opponentId,
        status: "active",
      })
      .select()
      .single()

    if (error) throw error

    this.currentRoom = room
    this.initializeGame()
  }

  private initializeGame() {
    if (!this.currentRoom || !this.currentPlayer) return

    this.gameEngine = new TrucoEngine()
    const initialState = this.gameEngine.getGameState()

    // Set player names
    initialState.players[0].name = this.currentPlayer.username

    // Update room with initial game state
    this.updateGameState(initialState)

    // Subscribe to real-time updates
    this.subscribeToGameUpdates()
  }

  private subscribeToGameUpdates() {
    if (!this.currentRoom) return

    // Subscribe to game moves
    this.supabase
      .channel(`game-${this.currentRoom.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_moves",
          filter: `room_id=eq.${this.currentRoom.id}`,
        },
        (payload) => {
          this.handleGameMove(payload.new as GameMove)
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_rooms",
          filter: `id=eq.${this.currentRoom.id}`,
        },
        (payload) => {
          this.handleRoomUpdate(payload.new as GameRoom)
        },
      )
      .subscribe()
  }

  private handleGameMove(move: GameMove) {
    if (!this.gameEngine || !this.currentPlayer) return

    // Don't process our own moves
    if (move.player_id === this.currentPlayer.id) return

    // Apply move to game engine
    const action: GameAction = {
      type: move.move_type as any,
      ...move.move_data,
    }

    this.gameEngine.processAction(action)
    const newState = this.gameEngine.getGameState()

    if (this.onGameStateChange) {
      this.onGameStateChange(newState)
    }
  }

  private handleRoomUpdate(room: GameRoom) {
    this.currentRoom = room

    if (room.current_game_state && this.onGameStateChange) {
      this.onGameStateChange(room.current_game_state)
    }
  }

  async sendGameAction(action: GameAction): Promise<void> {
    if (!this.currentRoom || !this.currentPlayer || !this.gameEngine) return

    // Process action locally first
    this.gameEngine.processAction(action)
    const newState = this.gameEngine.getGameState()

    // Send move to database
    const { error } = await this.supabase.from("game_moves").insert({
      room_id: this.currentRoom.id,
      player_id: this.currentPlayer.id,
      move_type: action.type,
      move_data: action,
    })

    if (error) {
      console.error("Error sending move:", error)
      return
    }

    // Update game state in room
    await this.updateGameState(newState)

    if (this.onGameStateChange) {
      this.onGameStateChange(newState)
    }
  }

  private async updateGameState(state: GameState) {
    if (!this.currentRoom) return

    await this.supabase
      .from("game_rooms")
      .update({
        current_game_state: state,
        status: state.gamePhase === "gameOver" ? "finished" : "active",
      })
      .eq("id", this.currentRoom.id)
  }

  async leaveGame(): Promise<void> {
    if (this.currentRoom) {
      // Mark room as finished
      await this.supabase.from("game_rooms").update({ status: "finished" }).eq("id", this.currentRoom.id)
    }

    // Remove from matchmaking queue
    if (this.currentPlayer) {
      await this.supabase.from("matchmaking_queue").delete().eq("player_id", this.currentPlayer.id)
    }

    this.currentRoom = null
    this.gameEngine = null
  }

  onGameStateChanged(callback: (state: GameState) => void) {
    this.onGameStateChange = callback
  }

  onPlayerJoinedGame(callback: (player: Player) => void) {
    this.onPlayerJoined = callback
  }

  onPlayerLeftGame(callback: () => void) {
    this.onPlayerLeft = callback
  }

  onErrorOccurred(callback: (error: string) => void) {
    this.onError = callback
  }

  getCurrentPlayer(): Player | null {
    return this.currentPlayer
  }

  getCurrentRoom(): GameRoom | null {
    return this.currentRoom
  }
}
