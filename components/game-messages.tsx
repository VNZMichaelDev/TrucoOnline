"use client"
import type { GameState } from "@/lib/types"

interface GameMessagesProps {
  message: string
  gameState: GameState
}

export default function GameMessages({ message, gameState }: GameMessagesProps) {
  const getGameStatusMessage = () => {
    if (gameState.phase === "finished") {
      const winner = gameState.players[0].score >= 30 ? gameState.players[0] : gameState.players[1]
      return `¡${winner.name} gana la partida!`
    }

    if (gameState.waitingForResponse) {
      const currentPlayer = gameState.players[gameState.currentPlayer]
      return `Esperando respuesta de ${currentPlayer.name}...`
    }

    if (gameState.currentPlayer === 0) {
      return "Tu turno"
    } else {
      return "Turno del Bot"
    }
  }

  const statusMessage = getGameStatusMessage()

  return (
    <div className="text-center h-8 flex flex-col justify-center">
      {message ? (
        <div className="bg-amber-600/90 border border-amber-500 rounded px-2 py-1 mx-auto max-w-xs">
          <p className="text-white font-medium text-xs">{message}</p>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3">
          <span className="text-amber-200 text-xs">{statusMessage}</span>
          <div className="flex gap-1">
            {[0, 1, 2].map((bazaIndex) => {
              const baza = gameState.bazas[bazaIndex]
              return (
                <div
                  key={bazaIndex}
                  className={`w-2 h-2 rounded-full border ${
                    baza
                      ? baza.winner === 0
                        ? "bg-green-500 border-green-400"
                        : "bg-red-500 border-red-400"
                      : bazaIndex === gameState.currentBaza
                        ? "bg-amber-400 border-amber-300"
                        : "bg-gray-600 border-gray-500"
                  }`}
                  title={
                    baza
                      ? `Baza ${bazaIndex + 1}: ${gameState.players[baza.winner].name}`
                      : bazaIndex === gameState.currentBaza
                        ? `Baza ${bazaIndex + 1}: En juego`
                        : `Baza ${bazaIndex + 1}: Pendiente`
                  }
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
