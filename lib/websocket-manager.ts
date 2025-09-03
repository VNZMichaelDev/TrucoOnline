export type GameEvent = {
  type: "PLAYER_ACTION" | "GAME_STATE_UPDATE" | "PLAYER_JOINED" | "PLAYER_LEFT" | "MATCH_FOUND" | "PING" | "PONG"
  playerId: string
  data?: any
  timestamp: number
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting"

export class WebSocketManager {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private pingInterval: NodeJS.Timeout | null = null
  private listeners: Map<string, ((event: GameEvent) => void)[]> = new Map()
  private connectionStatus: ConnectionStatus = "disconnected"
  private statusListeners: ((status: ConnectionStatus) => void)[] = []

  constructor(
    private playerId: string,
    private gameId?: string,
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.setConnectionStatus("connecting")

        // Simulate WebSocket connection for demo purposes
        // In production, this would connect to a real WebSocket server
        setTimeout(
          () => {
            this.setConnectionStatus("connected")
            this.startPingPong()
            resolve()
          },
          1000 + Math.random() * 2000,
        ) // 1-3 seconds connection time
      } catch (error) {
        this.setConnectionStatus("disconnected")
        reject(error)
      }
    })
  }

  disconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.setConnectionStatus("disconnected")
  }

  sendEvent(event: Omit<GameEvent, "playerId" | "timestamp">): void {
    if (this.connectionStatus !== "connected") {
      console.warn("Cannot send event: not connected")
      return
    }

    const fullEvent: GameEvent = {
      ...event,
      playerId: this.playerId,
      timestamp: Date.now(),
    }

    // Simulate network delay and potential packet loss
    setTimeout(
      () => {
        if (Math.random() > 0.05) {
          // 95% success rate
          this.simulateReceiveEvent(fullEvent)
        }
      },
      50 + Math.random() * 200,
    ) // 50-250ms latency
  }

  private simulateReceiveEvent(event: GameEvent): void {
    // Simulate receiving events from other players
    const listeners = this.listeners.get(event.type) || []
    listeners.forEach((listener) => listener(event))
  }

  addEventListener(eventType: string, listener: (event: GameEvent) => void): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, [])
    }
    this.listeners.get(eventType)!.push(listener)
  }

  removeEventListener(eventType: string, listener: (event: GameEvent) => void): void {
    const listeners = this.listeners.get(eventType)
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  addConnectionStatusListener(listener: (status: ConnectionStatus) => void): void {
    this.statusListeners.push(listener)
  }

  removeConnectionStatusListener(listener: (status: ConnectionStatus) => void): void {
    const index = this.statusListeners.indexOf(listener)
    if (index > -1) {
      this.statusListeners.splice(index, 1)
    }
  }

  private setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status
    this.statusListeners.forEach((listener) => listener(status))
  }

  private startPingPong(): void {
    this.pingInterval = setInterval(() => {
      if (this.connectionStatus === "connected") {
        this.sendEvent({ type: "PING" })
      }
    }, 30000) // Ping every 30 seconds
  }

  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setConnectionStatus("disconnected")
      return
    }

    this.setConnectionStatus("reconnecting")
    this.reconnectAttempts++

    try {
      await new Promise((resolve) => setTimeout(resolve, this.reconnectDelay))
      await this.connect()
      this.reconnectAttempts = 0
    } catch (error) {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000) // Max 10 seconds
      await this.reconnect()
    }
  }

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus
  }
}
