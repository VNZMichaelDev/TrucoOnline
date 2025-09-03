"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Pause } from "lucide-react"
import { TrucoEngine } from "@/lib/truco-engine"
import { useAudio } from "@/hooks/use-audio"
import { useRealtimeGame } from "@/hooks/use-realtime-game"
import HandDisplay from "@/components/ui/hand-display"
import TableDisplay from "@/components/ui/table-display"
import CardBack from "@/components/ui/card-back"
import GameActions from "@/components/game-actions"
import ScoreBoard from "@/components/score-board"
import GameMessages from "@/components/game-messages"
import ConnectionStatusComponent from "@/components/connection-status"
import GamePauseOverlay from "@/components/game-pause-overlay"
import type { GameState, GameAction } from "@/lib/types"

interface GameScreenProps {
  playerName: string
  opponentName: string
  gameId: string // Added gameId prop for real multiplayer
  onBackToMenu: () => void
}

export default function GameScreen({ playerName, opponentName, gameId, onBackToMenu }: GameScreenProps) {
  const [gameEngine] = useState(() => {
    const engine = new TrucoEngine(playerName)
    const initialState = engine.getGameState()
    // Set opponent name
    initialState.players[1].name = opponentName
    initialState.players[1].isBot = false
    return engine
  })

  const [gameState, setGameState] = useState<GameState>(() => gameEngine.getGameState())
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | undefined>()
  const [message, setMessage] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [pauseReason, setPauseReason] = useState<"manual" | "connection" | "opponent_left">("manual")
  const [opponentDisconnected, setOpponentDisconnected] = useState(false)

  const { playSound, startBackgroundMusic, stopBackgroundMusic } = useAudio()

  const { connectionStatus, latency, sendPlayerAction, sendGameStateUpdate, reconnect, isConnected } = useRealtimeGame({
    playerId: playerName,
    gameId, // Use the gameId from matchmaking
    onOpponentAction: (action: GameAction) => {
      // Process opponent's action
      processOpponentAction(action)
    },
    onGameStateUpdate: (newGameState: GameState) => {
      // Sync game state from opponent
      setGameState(newGameState)
    },
    onPlayerLeft: (playerId: string) => {
      setOpponentDisconnected(true)
      setPauseReason("opponent_left")
      setIsPaused(true)
      setMessage(`${playerId} se desconectó`)
    },
    onPlayerJoined: (playerId: string) => {
      if (opponentDisconnected) {
        setOpponentDisconnected(false)
        setIsPaused(false)
        setMessage(`${playerId} se reconectó`)
        setTimeout(() => setMessage(""), 3000)
      }
    },
  })

  useEffect(() => {
    if (connectionStatus === "disconnected" || connectionStatus === "reconnecting") {
      setPauseReason("connection")
      setIsPaused(true)
    } else if (connectionStatus === "connected" && pauseReason === "connection") {
      setIsPaused(false)
    }
  }, [connectionStatus, pauseReason])

  // Start background music when game starts
  useEffect(() => {
    startBackgroundMusic()
    return () => stopBackgroundMusic()
  }, [])

  const processOpponentAction = (action: GameAction) => {
    const newState = gameEngine.processAction(action)
    setGameState(newState)

    // Play sound effects for opponent actions
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

    // Update message based on action
    updateMessage(action, newState)
  }

  const processLocalAction = (action: GameAction) => {
    if (!isConnected) {
      setMessage("Sin conexión - no se puede jugar")
      return
    }

    const newState = gameEngine.processAction(action)
    setGameState(newState)
    setSelectedCardIndex(undefined)

    // Send action to opponent
    sendPlayerAction(action)

    // Send updated game state
    sendGameStateUpdate(newState)

    // Play local sound effects
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

    // Check for game end and play appropriate sound
    if (newState.phase === "finished") {
      const winner = newState.players[0].score >= 30 ? 0 : 1
      if (winner === 0) {
        playSound("win")
      } else {
        playSound("lose")
      }
    }

    // Update message based on action
    updateMessage(action, newState)
  }

  const updateMessage = (action: GameAction, state: GameState) => {
    const actingPlayer =
      action.type === "PLAY_CARD"
        ? state.table.length === 1
          ? state.players[0]
          : state.players[1]
        : state.players[1 - state.currentPlayer]

    switch (action.type) {
      case "SING_TRUCO":
        setMessage(`${actingPlayer.name} canta: ¡TRUCO!`)
        break
      case "SING_RETRUCO":
        setMessage(`${actingPlayer.name} canta: ¡RETRUCO!`)
        break
      case "SING_VALE_CUATRO":
        setMessage(`${actingPlayer.name} canta: ¡VALE CUATRO!`)
        break
      case "SING_ENVIDO":
        setMessage(`${actingPlayer.name} canta: ¡ENVIDO!`)
        break
      case "SING_REAL_ENVIDO":
        setMessage(`${actingPlayer.name} canta: ¡REAL ENVIDO!`)
        break
      case "ACCEPT":
        setMessage(`${actingPlayer.name}: ¡Quiero!`)
        break
      case "REJECT":
        setMessage(`${actingPlayer.name}: ¡No quiero!`)
        break
      case "GO_TO_DECK":
        setMessage(`${actingPlayer.name} se va al mazo`)
        break
      case "PLAY_CARD":
        if (state.table.length === 2) {
          const winner = state.bazas[state.bazas.length - 1]?.winner
          const winnerName = state.players[winner].name
          setMessage(`${winnerName} gana la baza`)
        }
        break
      default:
        setMessage("")
    }

    // Clear message after delay
    if (action.type !== "PLAY_CARD") {
      setTimeout(() => setMessage(""), 3000)
    }
  }

  const handleCardClick = (cardIndex: number) => {
    if (
      gameState.currentPlayer === 0 &&
      gameEngine.canPlayCard(cardIndex) &&
      !isProcessing &&
      isConnected &&
      !isPaused
    ) {
      setSelectedCardIndex(cardIndex)
    }
  }

  const handlePlayCard = () => {
    if (selectedCardIndex !== undefined && !isPaused) {
      processLocalAction({ type: "PLAY_CARD", cardIndex: selectedCardIndex })
    }
  }

  const handleGameAction = (action: GameAction) => {
    if (!isProcessing && isConnected && !isPaused) {
      processLocalAction(action)
    }
  }

  const handlePauseGame = () => {
    setPauseReason("manual")
    setIsPaused(true)
  }

  const handleResumeGame = () => {
    if (pauseReason === "manual") {
      setIsPaused(false)
    }
  }

  const handleNewGame = () => {
    const newEngine = new TrucoEngine(playerName)
    const newState = newEngine.getGameState()
    newState.players[1].name = opponentName
    newState.players[1].isBot = false

    setGameState(newState)
    setSelectedCardIndex(undefined)
    setMessage("")
    setIsProcessing(false)

    // Send new game state to opponent
    if (isConnected) {
      sendGameStateUpdate(newState)
    }
  }

  const playerHand = gameState.players[0].hand
  const opponentHand = gameState.players[1].hand
  const playerCard = gameState.table[0]
  const opponentCard = gameState.table[1]
  const isPlayerTurn = gameState.currentPlayer === 0 && !gameState.waitingForResponse

  return (
    <>
      <div
        className="h-screen overflow-hidden flex flex-col bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url(https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fondojuego.jpg-aASnDGPRF1q77ESLQSAJr6YUx7O1sJ.jpeg)",
        }}
      >
        <div className="flex items-center justify-between p-3 h-16 flex-shrink-0 bg-black/30 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBackToMenu}
              className="text-amber-200 hover:bg-amber-600/30 h-10 w-10 rounded-full"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h1 className="text-lg font-bold text-amber-200 drop-shadow-lg">Truco Online</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePauseGame}
              className="text-amber-200 hover:bg-amber-600/30 h-8 w-8 rounded-full"
              disabled={!isConnected || isPaused}
            >
              <Pause className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionStatusComponent
              status={connectionStatus}
              latency={latency}
              onReconnect={reconnect}
              onBackToMenu={onBackToMenu}
            />
            <ScoreBoard gameState={gameState} />
          </div>
        </div>

        <div className="h-10 flex-shrink-0 bg-black/20">
          <GameMessages message={message} gameState={gameState} />
        </div>

        <div className="flex-1 flex flex-col justify-between px-3 py-2" style={{ height: "calc(100vh - 104px)" }}>
          <div className="text-center h-20 flex-shrink-0">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="bg-red-600/80 px-3 py-1 rounded-full">
                <span className="text-white font-semibold text-sm">{opponentName}</span>
                <span className="text-red-200 text-sm ml-1">({opponentHand.length})</span>
              </div>
            </div>
            <div className="flex justify-center gap-1">
              {opponentHand.map((_, index) => (
                <CardBack key={index} size="small" />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center h-28 flex-shrink-0 my-2">
            <Card className="bg-black/80 border-2 border-amber-500/50 p-3 w-full max-w-sm rounded-xl shadow-2xl">
              <CardContent className="p-0">
                <TableDisplay playerCard={playerCard} botCard={opponentCard} />
              </CardContent>
            </Card>
          </div>

          <div className="flex-shrink-0">
            <div className="text-center mb-2">
              <div className="bg-blue-600/80 px-3 py-1 rounded-full inline-block">
                <span className="text-white font-semibold text-sm">{playerName}</span>
              </div>
            </div>

            <HandDisplay
              cards={playerHand}
              isPlayerHand={true}
              onCardClick={handleCardClick}
              selectedCardIndex={selectedCardIndex}
              className="mb-3"
            />

            <div className="flex flex-col gap-2 px-1 pb-3">
              {/* Play Card Button */}
              {selectedCardIndex !== undefined && isPlayerTurn && isConnected && !isPaused && (
                <Button
                  onClick={handlePlayCard}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold h-12 text-base rounded-xl shadow-lg transform active:scale-95 transition-all"
                  disabled={isProcessing || !isConnected || isPaused}
                >
                  Jugar Carta
                </Button>
              )}

              {/* Game Actions */}
              <GameActions
                gameState={gameState}
                onAction={handleGameAction}
                disabled={isProcessing || gameState.currentPlayer === 1 || !isConnected || isPaused}
              />

              {/* New Game Button (when game finished) */}
              {gameState.phase === "finished" && (
                <Button
                  onClick={handleNewGame}
                  className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold h-12 text-base rounded-xl shadow-lg transform active:scale-95 transition-all"
                  disabled={!isConnected}
                >
                  Nueva Partida
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <GamePauseOverlay
        isPaused={isPaused}
        reason={pauseReason}
        onResume={handleResumeGame}
        onBackToMenu={onBackToMenu}
        onReconnect={reconnect}
        opponentName={opponentName}
      />
    </>
  )
}
