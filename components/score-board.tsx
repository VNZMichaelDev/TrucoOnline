"use client"

import { Card, CardContent } from "@/components/ui/card"
import type { GameState } from "@/lib/types"

interface ScoreBoardProps {
  gameState: GameState
}

export default function ScoreBoard({ gameState }: ScoreBoardProps) {
  const playerScore = gameState.players[0].score
  const opponentScore = gameState.players[1].score
  const playerName = gameState.players[0].name
  const opponentName = gameState.players[1].name

  return (
    <div className="fixed top-4 right-4 z-10">
      <Card className="bg-black/80 border-amber-600 shadow-lg backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-6 text-sm min-w-[200px]">
            <div className="text-center flex-1">
              <div className="text-amber-200 font-medium text-xs mb-1">{playerName}</div>
              <div className="text-amber-100 text-2xl font-bold">{playerScore}</div>
            </div>
            <div className="text-amber-400 text-xl font-bold">-</div>
            <div className="text-center flex-1">
              <div className="text-amber-200 font-medium text-xs mb-1">{opponentName}</div>
              <div className="text-amber-100 text-2xl font-bold">{opponentScore}</div>
            </div>
          </div>
          
          {/* CORREGIDO: Mostrar objetivo de puntos */}
          <div className="mt-2 text-center">
            <div className="text-amber-300 text-xs font-medium">
              Primero a 30 puntos
            </div>
          </div>

          {/* Game Status */}
          <div className="mt-3 text-center">
            {gameState.trucoLevel > 0 && (
              <div className="text-red-400 text-xs font-medium bg-red-900/30 px-2 py-1 rounded">
                {gameState.trucoLevel === 1 && "Truco"}
                {gameState.trucoLevel === 2 && "Retruco"}
                {gameState.trucoLevel === 3 && "Vale Cuatro"}
              </div>
            )}
            {gameState.envidoLevel > 0 && (
              <div className="text-blue-400 text-xs font-medium bg-blue-900/30 px-2 py-1 rounded mt-1">
                {gameState.envidoLevel === 1 && "Envido"}
                {gameState.envidoLevel === 2 && "Real Envido"}
                {gameState.envidoLevel === 3 && "Falta Envido"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
