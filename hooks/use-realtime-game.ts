"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { WebSocketManager, type GameEvent, type ConnectionStatus } from "@/lib/websocket-manager"
import type { GameState, GameAction } from "@/lib/types"

interface UseRealtimeGameProps {
  playerId: string
  gameId?: string
  onGameStateUpdate?: (gameState: GameState) => void
  onOpponentAction?: (action: GameAction) => void
  onPlayerJoined?: (playerId: string) => void
  onPlayerLeft?: (playerId: string) => void
}

export function useRealtimeGame({
  playerId,
  gameId,
  onGameStateUpdate,
  onOpponentAction,
  onPlayerJoined,
  onPlayerLeft,
}: UseRealtimeGameProps) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected")
  const [connectedPlayers, setConnectedPlayers] = useState<string[]>([])
  const [latency, setLatency] = useState<number>(0)
  const wsManager = useRef<WebSocketManager | null>(null)
  const pingStartTime = useRef<number>(0)

  // Initialize WebSocket connection
  useEffect(() => {
    wsManager.current = new WebSocketManager(playerId, gameId)

    const manager = wsManager.current

    // Connection status listener
    const statusListener = (status: ConnectionStatus) => {
      setConnectionStatus(status)
    }
    manager.addConnectionStatusListener(statusListener)

    // Game event listeners
    const gameStateListener = (event: GameEvent) => {
      if (event.type === "GAME_STATE_UPDATE" && onGameStateUpdate) {
        onGameStateUpdate(event.data)
      }
    }

    const playerActionListener = (event: GameEvent) => {
      if (event.type === "PLAYER_ACTION" && onOpponentAction && event.playerId !== playerId) {
        onOpponentAction(event.data)
      }
    }

    const playerJoinedListener = (event: GameEvent) => {
      if (event.type === "PLAYER_JOINED" && onPlayerJoined) {
        setConnectedPlayers((prev) => [...prev, event.playerId])
        onPlayerJoined(event.playerId)
      }
    }

    const playerLeftListener = (event: GameEvent) => {
      if (event.type === "PLAYER_LEFT" && onPlayerLeft) {
        setConnectedPlayers((prev) => prev.filter((id) => id !== event.playerId))
        onPlayerLeft(event.playerId)
      }
    }

    const pingListener = (event: GameEvent) => {
      if (event.type === "PING" && event.playerId === playerId) {
        pingStartTime.current = event.timestamp
      }
    }

    const pongListener = (event: GameEvent) => {
      if (event.type === "PONG" && event.playerId === playerId) {
        const currentLatency = Date.now() - pingStartTime.current
        setLatency(currentLatency)
      }
    }

    // Add event listeners
    manager.addEventListener("GAME_STATE_UPDATE", gameStateListener)
    manager.addEventListener("PLAYER_ACTION", playerActionListener)
    manager.addEventListener("PLAYER_JOINED", playerJoinedListener)
    manager.addEventListener("PLAYER_LEFT", playerLeftListener)
    manager.addEventListener("PING", pingListener)
    manager.addEventListener("PONG", pongListener)

    // Connect
    manager.connect().catch(console.error)

    // Cleanup
    return () => {
      manager.removeConnectionStatusListener(statusListener)
      manager.removeEventListener("GAME_STATE_UPDATE", gameStateListener)
      manager.removeEventListener("PLAYER_ACTION", playerActionListener)
      manager.removeEventListener("PLAYER_JOINED", playerJoinedListener)
      manager.removeEventListener("PLAYER_LEFT", playerLeftListener)
      manager.removeEventListener("PING", pingListener)
      manager.removeEventListener("PONG", pongListener)
      manager.disconnect()
    }
  }, [playerId, gameId, onGameStateUpdate, onOpponentAction, onPlayerJoined, onPlayerLeft])

  const sendPlayerAction = useCallback((action: GameAction) => {
    if (wsManager.current) {
      wsManager.current.sendEvent({
        type: "PLAYER_ACTION",
        data: action,
      })
    }
  }, [])

  const sendGameStateUpdate = useCallback((gameState: GameState) => {
    if (wsManager.current) {
      wsManager.current.sendEvent({
        type: "GAME_STATE_UPDATE",
        data: gameState,
      })
    }
  }, [])

  const reconnect = useCallback(async () => {
    if (wsManager.current) {
      try {
        await wsManager.current.connect()
      } catch (error) {
        console.error("Failed to reconnect:", error)
      }
    }
  }, [])

  return {
    connectionStatus,
    connectedPlayers,
    latency,
    sendPlayerAction,
    sendGameStateUpdate,
    reconnect,
    isConnected: connectionStatus === "connected",
  }
}
