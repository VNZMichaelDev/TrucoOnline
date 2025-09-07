"use client"

import { Button } from "@/components/ui/button"
import type { GameState, GameAction, BettingState } from "@/lib/types"

interface GameActionsProps {
  gameState: GameState
  onAction: (action: GameAction) => void
  disabled?: boolean
  bettingState?: BettingState
}

export default function GameActions({ gameState, onAction, disabled = false, bettingState }: GameActionsProps) {
  const betting = bettingState || getBettingState(gameState)

  if (gameState.phase === "finished") {
    return null
  }

  return (
    <>
      {/* Envido Actions */}
      {betting.canSingEnvido && (
        <Button
          onClick={() => onAction({ type: "SING_ENVIDO" })}
          disabled={disabled}
          variant="outline"
          className="border-2 border-blue-500 text-blue-400 hover:bg-blue-500/20 h-8 text-xs font-bold rounded-lg"
        >
          Envido
        </Button>
      )}

      {betting.canSingRealEnvido && (
        <Button
          onClick={() => onAction({ type: "SING_REAL_ENVIDO" })}
          disabled={disabled}
          variant="outline"
          className="border-2 border-blue-500 text-blue-400 hover:bg-blue-500/20 h-8 text-xs font-bold rounded-lg"
        >
          Real Envido
        </Button>
      )}

      {betting.canSingFaltaEnvido && (
        <Button
          onClick={() => onAction({ type: "SING_FALTA_ENVIDO" })}
          disabled={disabled}
          variant="outline"
          className="border-2 border-blue-500 text-blue-400 hover:bg-blue-500/20 h-8 text-xs font-bold rounded-lg"
        >
          Falta Envido
        </Button>
      )}

      {/* Truco Actions */}
      {betting.canSingTruco && (
        <Button
          onClick={() => onAction({ type: "SING_TRUCO" })}
          disabled={disabled}
          variant="outline"
          className="border-2 border-red-500 text-red-400 hover:bg-red-500/20 h-8 text-xs font-bold rounded-lg"
        >
          Truco
        </Button>
      )}

      {betting.canSingRetruco && (
        <Button
          onClick={() => onAction({ type: "SING_RETRUCO" })}
          disabled={disabled}
          variant="outline"
          className="border-2 border-red-500 text-red-400 hover:bg-red-500/20 h-8 text-xs font-bold rounded-lg"
        >
          Retruco
        </Button>
      )}

      {betting.canSingValeCuatro && (
        <Button
          onClick={() => onAction({ type: "SING_VALE_CUATRO" })}
          disabled={disabled}
          variant="outline"
          className="border-2 border-red-500 text-red-400 hover:bg-red-500/20 h-8 text-xs font-bold rounded-lg"
        >
          Vale Cuatro
        </Button>
      )}

      {/* Response Actions */}
      {betting.canAccept && (
        <Button
          onClick={() => onAction({ type: "ACCEPT" })}
          disabled={disabled}
          className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs font-bold rounded-lg shadow-lg"
        >
          Quiero
        </Button>
      )}

      {betting.canReject && (
        <Button
          onClick={() => onAction({ type: "REJECT" })}
          disabled={disabled}
          className="bg-red-600 hover:bg-red-700 text-white h-8 text-xs font-bold rounded-lg shadow-lg"
        >
          No Quiero
        </Button>
      )}

      {/* Go to Deck */}
      {betting.canGoToDeck && (
        <Button
          onClick={() => onAction({ type: "GO_TO_DECK" })}
          disabled={disabled}
          variant="outline"
          className="border-2 border-gray-500 text-gray-400 hover:bg-gray-500/20 col-span-2 h-8 text-xs font-bold rounded-lg"
        >
          Irse al Mazo
        </Button>
      )}
    </>
  )
}

function getBettingState(gameState: GameState) {
  const currentPlayerIndex =
    typeof gameState.currentPlayer === "number"
      ? gameState.currentPlayer
      : gameState.currentPlayer === "player1"
        ? 0
        : 1

  const currentPlayer = gameState.players[currentPlayerIndex] || { isBot: false }
  const isFirstBaza = gameState.currentBaza === 0
  const hasPlayedCard = gameState.table.length > 0
  const isWaitingForResponse = gameState.waitingForResponse

  return {
    canSingTruco: !isWaitingForResponse && gameState.trucoLevel === 0 && !hasPlayedCard && !currentPlayer.isBot,
    canSingRetruco: false, // This fallback won't be used when proper bettingState is passed
    canSingValeCuatro: false, // This fallback won't be used when proper bettingState is passed
    canSingEnvido: !isWaitingForResponse && gameState.envidoLevel === 0 && isFirstBaza && !hasPlayedCard && !currentPlayer.isBot,
    canSingRealEnvido: false, // This fallback won't be used when proper bettingState is passed
    canSingFaltaEnvido: false, // This fallback won't be used when proper bettingState is passed
    canAccept: isWaitingForResponse && !currentPlayer.isBot,
    canReject: isWaitingForResponse && !currentPlayer.isBot,
    canGoToDeck: !isWaitingForResponse && !currentPlayer.isBot,
  }
}
