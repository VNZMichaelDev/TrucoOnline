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
    <div className="grid grid-cols-2 gap-2">
      {/* Envido Actions */}
      {bettingState.canSingEnvido && (
        <>
          <Button
            onClick={() => onAction({ type: "SING_ENVIDO" })}
            disabled={disabled}
            variant="outline"
            className="border-2 border-blue-500 bg-blue-500/10 text-blue-300 hover:bg-blue-500/30 hover:text-white h-11 text-sm font-bold rounded-xl shadow-lg transform active:scale-95 transition-all"
          >
            💎 Envido
          </Button>
          <Button
            onClick={() => onAction({ type: "SING_REAL_ENVIDO" })}
            disabled={disabled}
            variant="outline"
            className="border-2 border-blue-500 bg-blue-500/10 text-blue-300 hover:bg-blue-500/30 hover:text-white h-11 text-sm font-bold rounded-xl shadow-lg transform active:scale-95 transition-all"
          >
            💎 Real Envido
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
              className="border-2 border-red-500 bg-red-500/10 text-red-300 hover:bg-red-500/30 hover:text-white h-11 text-sm font-bold rounded-xl shadow-lg transform active:scale-95 transition-all"
            >
              ⚡ Truco
            </Button>
          )}
          {gameState.trucoLevel === 1 && (
            <Button
              onClick={() => onAction({ type: "SING_RETRUCO" })}
              disabled={disabled}
              variant="outline"
              className="border-2 border-red-500 bg-red-500/10 text-red-300 hover:bg-red-500/30 hover:text-white h-11 text-sm font-bold rounded-xl shadow-lg transform active:scale-95 transition-all"
            >
              ⚡ Retruco
            </Button>
          )}
          {gameState.trucoLevel === 2 && (
            <Button
              onClick={() => onAction({ type: "SING_VALE_CUATRO" })}
              disabled={disabled}
              variant="outline"
              className="border-2 border-red-500 bg-red-500/10 text-red-300 hover:bg-red-500/30 hover:text-white h-11 text-sm font-bold rounded-xl shadow-lg transform active:scale-95 transition-all"
            >
              ⚡ Vale Cuatro
            </Button>
          )}
        </>
      )}

      {/* Response Actions */}
      {bettingState.canAccept && (
        <Button
          onClick={() => onAction({ type: "ACCEPT" })}
          disabled={disabled}
          className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white h-11 text-sm font-bold rounded-xl shadow-lg transform active:scale-95 transition-all"
        >
          ✅ Quiero
        </Button>
      )}

      {bettingState.canReject && (
        <Button
          onClick={() => onAction({ type: "REJECT" })}
          disabled={disabled}
          className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white h-11 text-sm font-bold rounded-xl shadow-lg transform active:scale-95 transition-all"
        >
          ❌ No Quiero
        </Button>
      )}

      {/* Go to Deck */}
      {bettingState.canGoToDeck && (
        <Button
          onClick={() => onAction({ type: "GO_TO_DECK" })}
          disabled={disabled}
          variant="outline"
          className="border-2 border-gray-500 bg-gray-500/10 text-gray-300 hover:bg-gray-500/30 hover:text-white col-span-2 h-11 text-sm font-bold rounded-xl shadow-lg transform active:scale-95 transition-all"
        >
          🚪 Irse al Mazo
        </Button>
      )}
    </div>
  )
}

function getBettingState(gameState: GameState) {
  const currentPlayer = gameState.players[gameState.currentPlayer]
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
