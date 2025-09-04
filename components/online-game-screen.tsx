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
import ScoreBoard from "@/components/score-board"
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
  const [status, setStatus] = useState<string>("")
  const [isConnected, setIsConnected] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [canStartGame, setCanStartGame] = useState(false)
  const [opponentName, setOpponentName] = useState<string>("Oponente")
  const [isPlayerInitialized, setIsPlayerInitialized] = useState(false)

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
      console.log("[v0] Initializing online game for:", playerName, "user:", user?.id)

      await gameManager.createOrGetPlayer(playerName, user?.id)
      setIsPlayerInitialized(true)

      gameManager.setStatusCallback((newStatus) => {
        console.log("[v0] Status update:", newStatus)
        setStatus(newStatus)
        if (newStatus.includes("encontrado")) {
          setCanStartGame(true)
        }
      })

      gameManager.setGameStateCallback((newGameState) => {
        console.log("[v0] Received game state update:", newGameState)

        if (newGameState && newGameState.players && isPlayerInitialized) {
          const myPlayerId = gameManager.getPlayerId()

          let opponent = null
          if (gameManager.isPlayerOne()) {
            opponent = newGameState.players[1] // I'm player1, opponent is player2
          } else {
            opponent = newGameState.players[0] // I'm player2, opponent is player1
          }

          if (opponent) {
            setOpponentName(opponent.name)
          }

          if (myPlayerId) {
            const updatedEngine = OnlineTrucoEngine.fromSyncedState(newGameState, myPlayerId)
            setGameEngine(updatedEngine)
            setGameState(updatedEngine.getGameState())
          }
        }
      })

      setIsConnected(true)

      await gameManager.joinMatchmaking()
    } catch (error) {
      console.error("[v0] Error initializing online game:", error)
      setStatus("Error de conexión. Verifica tu autenticación.")
      setIsConnected(false)
    }
  }

  const startGame = async () => {
    console.log("[v0] Starting new game")
    setIsProcessing(true)

    try {
      if (!isPlayerInitialized) {
        throw new Error("Player not initialized")
      }

      const isReady = await gameManager.isGameReady()

      if (isReady) {
        setStatus("Sincronizando partida...")
      } else {
        if (gameManager.isPlayerOne()) {
          const myPlayerId = gameManager.getPlayerId()
          const engine = new OnlineTrucoEngine(playerName, opponentName, myPlayerId!)
          const initialState = engine.getSyncableState()

          console.log("[v0] Player1 initializing game with state:", initialState)
          await gameManager.startGame(initialState)
          setStatus("¡Partida iniciada!")
        } else {
          setStatus("Esperando que el oponente inicie la partida...")
        }
      }

      setCanStartGame(false)
    } catch (error) {
      console.error("[v0] Error starting game:", error)
      setStatus("Error al iniciar partida")
    } finally {
      setIsProcessing(false)
    }
  }

  const processAction = async (action: GameAction) => {
    if (!gameEngine || !gameState) {
      console.log("[v0] No game engine or state available")
      return
    }

    console.log("[v0] Processing action:", action, "isMyTurn:", gameEngine.isMyTurn())
    setIsProcessing(true)

    try {
      const isResponse = action.type === "ACCEPT" || action.type === "REJECT"

      if (!gameEngine.isMyTurn() && !isResponse) {
        console.log("[v0] Not my turn, cannot perform action:", action.type)
        setMessage("No es tu turno")
        setIsProcessing(false)
        return
      }

      if (isResponse && gameEngine.isMyTurn()) {
        console.log("[v0] Cannot respond to own bet")
        setMessage("No puedes responder a tu propia apuesta")
        setIsProcessing(false)
        return
      }

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
          const winner = state.bazas[state.bazas.length - 1]?.winner
          if (winner !== undefined) {
            const winnerName = winner === 0 ? myPlayer.name : opponent.name
            setMessage(`${winnerName} gana la baza`)
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

    console.log("[v0] Card clicked:", cardIndex, "canPlay:", gameEngine.canPlayCard(cardIndex))

    if (gameEngine.isMyTurn() && gameEngine.canPlayCard(cardIndex) && !isProcessing) {
      setSelectedCardIndex(cardIndex)
    } else {
      console.log("[v0] Cannot select card - not my turn or processing")
    }
  }

  const handlePlayCard = () => {
    if (selectedCardIndex !== undefined) {
      processAction({ type: "PLAY_CARD", cardIndex: selectedCardIndex })
    }
  }

  const handleGameAction = (action: GameAction) => {
    if (!isProcessing) {
      processAction(action)
    }
  }

  const handleNewGame = () => {
    startGame()
  }

  const handleBackToMenu = async () => {
    await gameManager.leaveMatchmaking()
    onBackToMenu()
  }

  if (!gameState || !isPlayerInitialized) {
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
                <p className="text-sm mt-2">{status || "Conectando..."}</p>
                {opponentName !== "Oponente" && <p className="text-sm text-green-400 mt-1">Oponente: {opponentName}</p>}
              </div>

              {status.includes("Esperando") && (
                <div className="animate-pulse">
                  <div className="h-2 bg-amber-600 rounded-full"></div>
                </div>
              )}

              {canStartGame && !isProcessing && (
                <Button
                  onClick={startGame}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12"
                  disabled={isProcessing}
                >
                  ¡Comenzar Partida!
                </Button>
              )}

              {isProcessing && (
                <div className="text-amber-200 text-sm">
                  <div className="animate-pulse">Iniciando partida...</div>
                </div>
              )}

              <Button
                onClick={handleBackToMenu}
                variant="outline"
                className="w-full border-2 border-amber-600 text-amber-200 hover:bg-amber-600/20 font-bold h-12 bg-transparent"
                disabled={isProcessing}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const myPlayerIndex = 0 // My player is always at index 0 in local state
  const opponentIndex = 1 // Opponent is always at index 1 in local state
  const playerHand = gameState.players[myPlayerIndex]?.hand || []
  const opponentHand = gameState.players[opponentIndex]?.hand || []
  const playerCard = gameState.table[0] // First card on table
  const opponentCard = gameState.table[1] // Second card on table
  const isMyTurn = gameEngine?.isMyTurn() || false

  console.log(
    "[v0] Render - isMyTurn:",
    isMyTurn,
    "currentPlayer:",
    gameState.currentPlayer,
    "waitingForResponse:",
    gameState.waitingForResponse,
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
      <div className="flex items-center justify-between p-2 h-14 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackToMenu}
            className="text-amber-200 hover:bg-amber-600/20 h-8 w-8"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-bold text-amber-200">Truco Online</h1>
          {isConnected ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
        </div>
        <ScoreBoard gameState={gameState} />
      </div>

      <div className="h-8 flex-shrink-0">
        <GameMessages message={message} gameState={gameState} />
      </div>

      <div className="flex-1 flex flex-col justify-between px-2" style={{ height: "calc(100vh - 88px)" }}>
        <div className="text-center h-16 flex-shrink-0">
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

        <div className="flex items-center justify-center h-24 flex-shrink-0">
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

          <div className="flex flex-col gap-1 px-1 pb-2">
            {selectedCardIndex !== undefined && isMyTurn && !gameState.waitingForResponse && (
              <Button
                onClick={handlePlayCard}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-10 text-sm rounded-lg"
                disabled={isProcessing}
              >
                Jugar Carta
              </Button>
            )}

            <GameActions
              gameState={gameState}
              onAction={handleGameAction}
              disabled={isProcessing}
              bettingState={gameEngine?.getBettingState()}
            />

            {gameState.phase === "finished" && (
              <Button
                onClick={handleNewGame}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-10 text-sm rounded-lg"
              >
                Nueva Partida
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
