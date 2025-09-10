"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Wifi, WifiOff } from "lucide-react"
import type { User } from "@supabase/supabase-js"
import { OnlineTrucoEngine } from "@/lib/online-truco-engine"
import { OnlineGameManager } from "@/lib/online-game-manager"
import { useAudio } from "@/hooks/use-audio"
import HandDisplay from "@/components/ui/hand-display"
import TableDisplay from "@/components/ui/table-display"
import CardBack from "@/components/ui/card-back"
import GameActions from "@/components/game-actions"
import GameMessages from "@/components/game-messages"
import type { GameState, GameAction } from "@/lib/types"

interface OnlineGameScreenProps {
  playerName: string
  onBackToMenu: () => void
  user: User | null // Added user prop for authentication
}

export default function OnlineGameScreen({ playerName, onBackToMenu, user }: OnlineGameScreenProps) {
  const [gameManager] = useState(() => new OnlineGameManager())
  const [gameEngine, setGameEngine] = useState<OnlineTrucoEngine | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | undefined>()
  const [message, setMessage] = useState<string>("")
  const [status, setStatus] = useState<string>("Buscando enemigo...")
  const [isConnected, setIsConnected] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [opponentName, setOpponentName] = useState<string>("Enemigo")
  const [isPlayerInitialized, setIsPlayerInitialized] = useState(false)
  const [autoStartAttempted, setAutoStartAttempted] = useState(false)
  const [gameReady, setGameReady] = useState(false)

  const { playSound, startBackgroundMusic, stopBackgroundMusic } = useAudio()

  useEffect(() => {
    if (!user) {
      setStatus("Error de autenticación. Redirigiendo...")
      setTimeout(() => {
        window.location.href = "/auth/login"
      }, 2000)
      return
    }

    initializeOnlineGame()
    startBackgroundMusic()

    return () => {
      stopBackgroundMusic()
      gameManager.cleanup()
    }
  }, [user])

  const initializeOnlineGame = async () => {
    try {
      // Generar ID único por dispositivo/sesión
      const deviceId = user?.id || `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      console.log("[v0] Initializing online game for:", playerName, "deviceId:", deviceId)
      setStatus("Conectando...")

      await gameManager.createOrGetPlayer(playerName, deviceId)
      setIsPlayerInitialized(true)

      gameManager.setStatusCallback((newStatus) => {
        console.log("[v0] Status update:", newStatus)
        setStatus(newStatus)
      })

      gameManager.setGameStateCallback(async (newGameState) => {
        console.log("[v0] Received game state update:", newGameState)

        if (newGameState && newGameState.players) {
          const myPlayerId = gameManager.getPlayerId()

          if (myPlayerId) {
            console.log("[v0] Processing game state for player:", myPlayerId)

            const mySimplePlayerId = gameManager.isPlayerOne() ? "player1" : "player2"
            console.log("[v0] Mapped UUID", myPlayerId, "to simple ID:", mySimplePlayerId)

            let opponent = null
            if (gameManager.isPlayerOne()) {
              opponent = newGameState.players[1]
            } else {
              opponent = newGameState.players[0]
            }

            if (opponent) {
              setOpponentName(opponent.name)
            }

            const updatedEngine = OnlineTrucoEngine.fromSyncedState(newGameState, mySimplePlayerId)
            setGameEngine(updatedEngine)
            setGameState(updatedEngine.getGameState())
            setGameReady(true)

            console.log("[v0] Game states updated - gameReady: true, gameEngine: set, gameState: set")

            const currentRoom = gameManager.getCurrentRoom()
            if (currentRoom?.status === "playing") {
              console.log("[v0] Game is now playing, updating status")
              setStatus("¡Partida en curso!")
            } else if (currentRoom?.status === "waiting" && !autoStartAttempted && gameManager.isPlayerOne()) {
              setAutoStartAttempted(true)
              setTimeout(() => autoStartGame(), 1000)
            }
          }
        }
      })

      setIsConnected(true)
      setStatus("Buscando enemigo...")

      await gameManager.joinMatchmaking()
    } catch (error) {
      console.error("[v0] Error initializing online game:", error)
      setStatus("Error de conexión. Verifica tu autenticación.")
      setIsConnected(false)
    }
  }

  const autoStartGame = async () => {
    console.log("[v0] Auto-starting game")
    setStatus("¡Enemigo encontrado! Iniciando partida...")

    try {
      const myPlayerId = gameManager.getPlayerId()
      if (!myPlayerId) throw new Error("Player ID not found")

      const mySimplePlayerId = gameManager.isPlayerOne() ? "player1" : "player2"
      console.log("[v0] Auto-starting with simple player ID:", mySimplePlayerId)

      const engine = new OnlineTrucoEngine(playerName, opponentName, mySimplePlayerId)
      const initialState = engine.getSyncableState()

      console.log("[v0] Auto-initializing game with state:", initialState)
      await gameManager.startGame(initialState)
      setStatus("¡Partida iniciada!")
    } catch (error) {
      console.error("[v0] Error auto-starting game:", error)
      setStatus("Error al iniciar partida automáticamente")
      setAutoStartAttempted(false)
    }
  }

  const processAction = async (action: GameAction) => {
    if (!gameEngine || !gameState) {
      console.log("[v0] No game engine or state available")
      return
    }

    const isMyTurnNow = gameEngine.isMyTurn()
    const isWaitingForResponse = gameState.waitingForResponse
    const isResponse = action.type === "ACCEPT" || action.type === "REJECT"

    console.log(
      "[v0] Processing action:",
      action.type,
      "isMyTurn:",
      isMyTurnNow,
      "waiting:",
      isWaitingForResponse,
      "isResponse:",
      isResponse,
    )

    if (isResponse) {
      if (isMyTurnNow) {
        console.log("[v0] Cannot respond to own bet")
        setMessage("No puedes responder a tu propia apuesta")
        return
      }
      if (!isWaitingForResponse) {
        console.log("[v0] No bet to respond to")
        setMessage("No hay apuesta para responder")
        return
      }
    } else {
      if (!isMyTurnNow) {
        console.log("[v0] Not my turn, cannot perform action:", action.type)
        setMessage("No es tu turno")
        return
      }
      if (isWaitingForResponse) {
        console.log("[v0] Waiting for response, cannot perform action:", action.type)
        setMessage("Esperando respuesta del enemigo")
        return
      }
    }

    setIsProcessing(true)

    try {
      const newState = gameEngine.processAction(action)
      setGameState(newState)
      setSelectedCardIndex(undefined)

      const syncableState = gameEngine.getSyncableState()
      console.log("[v0] Syncing state after action:", syncableState)

      await gameManager.makeMove(action)
      await gameManager.updateGameState(syncableState)

      switch (action.type) {
        case "PLAY_CARD":
          playSound("cardPlay")
          break
        case "SING_TRUCO":
        case "SING_RETRUCO":
        case "SING_VALE_CUATRO":
          playSound("truco")
          break
        case "SING_ENVIDO":
        case "SING_REAL_ENVIDO":
        case "SING_FALTA_ENVIDO":
          playSound("envido")
          break
      }

      updateMessage(action, newState)
    } catch (error) {
      console.error("[v0] Error processing action:", error)
      setMessage("Error al procesar la jugada")
    } finally {
      setIsProcessing(false)
    }
  }

  const updateMessage = (action: GameAction, state: GameState) => {
    const myPlayer = gameEngine?.getCurrentPlayer()
    const opponent = gameEngine?.getOpponent()

    if (!myPlayer || !opponent) return

    switch (action.type) {
      case "SING_TRUCO":
        setMessage(`${myPlayer.name} canta: ¡TRUCO!`)
        break
      case "SING_RETRUCO":
        setMessage(`${myPlayer.name} canta: ¡RETRUCO!`)
        break
      case "SING_VALE_CUATRO":
        setMessage(`${myPlayer.name} canta: ¡VALE CUATRO!`)
        break
      case "SING_ENVIDO":
        setMessage(`${myPlayer.name} canta: ¡ENVIDO!`)
        break
      case "SING_REAL_ENVIDO":
        setMessage(`${myPlayer.name} canta: ¡REAL ENVIDO!`)
        break
      case "ACCEPT":
        setMessage(`${myPlayer.name}: ¡Quiero!`)
        break
      case "REJECT":
        setMessage(`${myPlayer.name}: ¡No quiero!`)
        break
      case "GO_TO_DECK":
        setMessage(`${myPlayer.name} se va al mazo`)
        break
      case "PLAY_CARD":
        if (state.table.length === 2) {
          const lastBaza = state.bazas[state.bazas.length - 1]
          if (lastBaza) {
            if (lastBaza.isParda) {
              setMessage("¡Parda! - Empate en esta baza")
            } else {
              const winnerName = lastBaza.winnerName || (lastBaza.winner === 0 ? myPlayer.name : opponent.name)
              setMessage(`¡${winnerName} gana la baza!`)
            }
          }
        }
        break
      default:
        setMessage("")
    }

    if (action.type !== "PLAY_CARD") {
      setTimeout(() => setMessage(""), 3000)
    }
  }

  const handleCardClick = (cardIndex: number) => {
    if (!gameState || !gameEngine) return

    const canPlay = gameEngine.canPlayCard(cardIndex)
    const isMyTurnNow = gameEngine.isMyTurn()
    const isWaitingForResponse = gameState.waitingForResponse

    console.log(
      "[v0] Card clicked:",
      cardIndex,
      "canPlay:",
      canPlay,
      "isMyTurn:",
      isMyTurnNow,
      "waiting:",
      isWaitingForResponse,
    )

    if (isMyTurnNow && !isWaitingForResponse && canPlay && !isProcessing) {
      // Jugar la carta directamente sin necesidad de confirmación
      processAction({ type: "PLAY_CARD", cardIndex })
      console.log("[v0] Card played directly:", cardIndex)
    } else {
      console.log(
        "[v0] Card play blocked - isMyTurn:",
        isMyTurnNow,
        "waiting:",
        isWaitingForResponse,
        "canPlay:",
        canPlay,
        "processing:",
        isProcessing,
      )

      if (!isMyTurnNow) {
        setMessage("No es tu turno")
      } else if (isWaitingForResponse) {
        setMessage("Esperando respuesta del enemigo")
      } else if (!canPlay) {
        setMessage("No puedes jugar esta carta")
      } else if (isProcessing) {
        setMessage("Procesando jugada...")
      }

      setTimeout(() => setMessage(""), 2000)
    }
  }

  const handlePlayCard = () => {
    if (selectedCardIndex !== undefined && gameEngine?.isMyTurn() && !gameState?.waitingForResponse) {
      processAction({ type: "PLAY_CARD", cardIndex: selectedCardIndex })
    } else {
      setSelectedCardIndex(undefined)
      setMessage("No puedes jugar en este momento")
      setTimeout(() => setMessage(""), 2000)
    }
  }

  const handleGameAction = (action: GameAction) => {
    if (!isProcessing && gameEngine && gameState) {
      processAction(action)
    }
  }

  const handleBackToMenu = async () => {
    await gameManager.leaveMatchmaking()
    onBackToMenu()
  }

  console.log(
    "[v0] RENDER DEBUG - gameReady:",
    gameReady,
    "isPlayerInitialized:",
    isPlayerInitialized,
    "gameState:",
    !!gameState,
    "gameEngine:",
    !!gameEngine,
  )

  if (!gameReady || !isPlayerInitialized) {
    console.log("[v0] Showing matchmaking screen - gameReady:", gameReady, "isPlayerInitialized:", isPlayerInitialized)
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{
          backgroundImage:
            "url(https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fondomenuprincipal.jpg-Ga2pUnRel8thNe4kscmoDlG2Gd5pZJ.jpeg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <Card className="w-full max-w-sm mx-4 bg-black/80 border-amber-600 shadow-2xl">
          <CardContent className="p-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              {isConnected ? <Wifi className="h-6 w-6 text-green-500" /> : <WifiOff className="h-6 w-6 text-red-500" />}
              <h1 className="text-2xl font-bold text-amber-200">Partida Online</h1>
            </div>

            <div className="space-y-4">
              <div className="text-amber-100">
                <p className="text-lg">¡Hola {playerName}!</p>
                <p className="text-sm mt-2">{status}</p>
                {opponentName !== "Enemigo" && <p className="text-sm text-green-400 mt-1">Enemigo: {opponentName}</p>}
              </div>

              <div className="animate-pulse">
                <div className="h-2 bg-amber-600 rounded-full"></div>
              </div>

              <Button
                onClick={handleBackToMenu}
                variant="outline"
                className="w-full border-2 border-amber-600 text-amber-200 hover:bg-amber-600/20 font-bold h-12 bg-transparent"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!gameState || !gameEngine) {
    console.log(
      "[v0] GameReady is true but gameState or gameEngine is null - gameState:",
      !!gameState,
      "gameEngine:",
      !!gameEngine,
    )
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-amber-200">Cargando juego...</div>
      </div>
    )
  }

  const myPlayerIndex = gameEngine?.getMyPlayerIndex() || 0
  const opponentIndex = myPlayerIndex === 0 ? 1 : 0
  const playerHand = gameState.players[myPlayerIndex]?.hand || []
  const opponentHand = gameState.players[opponentIndex]?.hand || []
  const playerCard = gameState.table[myPlayerIndex] // My card on table
  const opponentCard = gameState.table[opponentIndex] // Opponent's card on table
  const isMyTurn = gameEngine?.isMyTurn() || false

  console.log(
    "[v0] Turn check - currentPlayer:",
    gameState.currentPlayer,
    "myPlayerIndex:",
    myPlayerIndex,
    "isMyTurn:",
    isMyTurn,
  )

  return (
    <div
      className="h-screen overflow-hidden flex flex-col"
      style={{
        backgroundImage:
          "url(https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fondojuego.jpg-aASnDGPRF1q77ESLQSAJr6YUx7O1sJ.jpeg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="flex items-center justify-between p-2 h-12 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackToMenu}
            className="text-amber-200 hover:bg-amber-600/20 h-7 w-7"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-sm font-bold text-amber-200">Truco Online</h1>
          {isConnected ? <Wifi className="h-3 w-3 text-green-500" /> : <WifiOff className="h-3 w-3 text-red-500" />}
        </div>
        <div className="bg-black/70 border border-amber-600 rounded px-2 py-1">
          <div className="flex items-center gap-3 text-xs">
            <div className="text-center">
              <div className="text-amber-200 font-medium">Jugador 1</div>
              <div className="text-white font-bold">{gameState.players[0]?.score || 0}</div>
            </div>
            <div className="text-amber-400">-</div>
            <div className="text-center">
              <div className="text-amber-200 font-medium">Jugador 2</div>
              <div className="text-white font-bold">{gameState.players[1]?.score || 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="h-6 flex-shrink-0">
        <GameMessages message={message} gameState={gameState} />
      </div>

      <div className="flex-1 flex flex-col justify-between px-2" style={{ height: "calc(100vh - 72px)" }}>
        <div className="text-center h-12 flex-shrink-0">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-amber-200 font-medium text-xs">{opponentName}</span>
            <span className="text-amber-300 text-xs">({opponentHand.length})</span>
            {!isMyTurn && !gameState.waitingForResponse && <span className="text-green-400 text-xs">(Su turno)</span>}
          </div>
          <div className="flex justify-center gap-1">
            {opponentHand.map((_, index) => (
              <CardBack key={index} size="small" />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center h-20 flex-shrink-0">
          <Card className="bg-black/70 border-amber-600 p-2 w-full max-w-xs">
            <CardContent className="p-0">
              <TableDisplay
                playerCard={playerCard}
                opponentCard={opponentCard}
                playerName={playerName}
                opponentName={opponentName}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex-shrink-0">
          <div className="text-center mb-1">
            <span className="text-amber-200 font-medium text-xs">{playerName}</span>
            {!isMyTurn && !gameState.waitingForResponse && (
              <span className="text-amber-400 text-xs ml-2">(Esperando...)</span>
            )}
            {isMyTurn && !gameState.waitingForResponse && (
              <span className="text-green-400 text-xs ml-2">(Tu turno)</span>
            )}
            {gameState.waitingForResponse && <span className="text-blue-400 text-xs ml-2">(Esperando respuesta)</span>}
          </div>

          <HandDisplay
            cards={playerHand}
            isPlayerHand={true}
            onCardClick={handleCardClick}
            selectedCardIndex={selectedCardIndex}
            className="mb-2"
          />

          <div className="flex flex-col gap-2 px-2 pb-2">
            <GameActions
              gameState={gameState}
              onAction={handleGameAction}
              disabled={isProcessing}
              bettingState={gameEngine?.getBettingState()}
            />

            {gameState.phase === "baza-result" && (
              <Button
                onClick={() => handleGameAction({ type: "CONTINUE_AFTER_BAZA" })}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 text-xs rounded-lg mt-1"
                disabled={isProcessing}
              >
                Continuar
              </Button>
            )}

            {gameState.phase === "finished" && (
              <Button
                onClick={handleBackToMenu}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-8 text-xs rounded-lg mt-1"
              >
                Volver al Menú
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
