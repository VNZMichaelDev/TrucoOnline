"use client"

import { Button } from "@/components/ui/button"
import type { GameState, GameAction } from "@/lib/types"

interface GameActionsProps {
  gameState: GameState
  onAction: (action: GameAction) => void
  disabled?: boolean
}

export default function GameActions({ gameState, onAction, disabled = false }: GameActionsProps) {
  const bettingState = getBettingState(gameState)

  if (gameState.phase === "finished") {
    return null
  }

  return (
    <div className="grid grid-cols-2 gap-1">
      {/* Envido Actions */}
      {bettingState.canSingEnvido && (
        <>
          <Button
            onClick={() => onAction({ type: "SING_ENVIDO" })}
            disabled={disabled}
            variant="outline"
            className="border-2 border-blue-500 text-blue-400 hover:bg-blue-500/20 h-9 text-sm font-bold rounded-lg"
          >
            Envido
          </Button>
          <Button
            onClick={() => onAction({ type: "SING_REAL_ENVIDO" })}
            disabled={disabled}
            variant="outline"
            className="border-2 border-blue-500 text-blue-400 hover:bg-blue-500/20 h-9 text-sm font-bold rounded-lg"
          >
            Real Envido
          </Button>
        </>
      )}

      {/* Truco Actions */}
      {bettingState.canSingTruco && (
        <>
          {gameState.trucoLevel === 0 && (
            <Button
              onClick={() => onAction({ type: "SING_TRUCO" })}
              disabled={disabled}
              variant="outline"
              className="border-2 border-red-500 text-red-400 hover:bg-red-500/20 h-9 text-sm font-bold rounded-lg"
            >
              Truco
            </Button>
          )}
          {gameState.trucoLevel === 1 && (
            <Button
              onClick={() => onAction({ type: "SING_RETRUCO" })}
              disabled={disabled}
              variant="outline"
              className="border-2 border-red-500 text-red-400 hover:bg-red-500/20 h-9 text-sm font-bold rounded-lg"
            >
              Retruco
            </Button>
          )}
          {gameState.trucoLevel === 2 && (
            <Button
              onClick={() => onAction({ type: "SING_VALE_CUATRO" })}
              disabled={disabled}
              variant="outline"
              className="border-2 border-red-500 text-red-400 hover:bg-red-500/20 h-9 text-sm font-bold rounded-lg"
            >
              Vale Cuatro
            </Button>
          )}
        </>
      )}

      {/* Response Actions */}
      {bettingState.canAccept && (
        <Button
          onClick={() => onAction({ type: "ACCEPT" })}
          disabled={disabled}
          className="bg-green-600 hover:bg-green-700 text-white h-9 text-sm font-bold rounded-lg shadow-lg"
        >
          Quiero
        </Button>
      )}

      {bettingState.canReject && (
        <Button
          onClick={() => onAction({ type: "REJECT" })}
          disabled={disabled}
          className="bg-red-600 hover:bg-red-700 text-white h-9 text-sm font-bold rounded-lg shadow-lg"
        >
          No Quiero
        </Button>
      )}

      {/* Go to Deck */}
      {bettingState.canGoToDeck && (
        <Button
          onClick={() => onAction({ type: "GO_TO_DECK" })}
          disabled={disabled}
          variant="outline"
          className="border-2 border-gray-500 text-gray-400 hover:bg-gray-500/20 col-span-2 h-9 text-sm font-bold rounded-lg"
        >
          Irse al Mazo
        </Button>
      )}
    </div>
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

  return {
    canSingTruco: !gameState.waitingForResponse && gameState.trucoLevel < 3 && !hasPlayedCard && !currentPlayer.isBot,
    canSingEnvido:
      !gameState.waitingForResponse &&
      gameState.envidoLevel === 0 &&
      isFirstBaza &&
      !hasPlayedCard &&
      !currentPlayer.isBot,
    canAccept: gameState.waitingForResponse && !currentPlayer.isBot,
    canReject: gameState.waitingForResponse && !currentPlayer.isBot,
    canGoToDeck: !gameState.waitingForResponse && !currentPlayer.isBot,
  }
}
