"use client"

import { Card, CardContent } from "@/components/ui/card"
import type { GameState } from "@/lib/types"

interface ScoreBoardProps {
  gameState: GameState
}

export default function ScoreBoard({ gameState }: ScoreBoardProps) {
  const playerScore = gameState.players[0].score
  const botScore = gameState.players[1].score
  const playerName = gameState.players[0].name

  return (
    <Card className="bg-black/70 border-amber-600">
      <CardContent className="p-3">
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <div className="text-amber-200 font-medium">{playerName}</div>
            <div className="text-amber-100 text-lg font-bold">{playerScore}</div>
          </div>
          <div className="text-amber-400">-</div>
          <div className="text-center">
            <div className="text-amber-200 font-medium">Bot</div>
            <div className="text-amber-100 text-lg font-bold">{botScore}</div>
          </div>
        </div>

        {/* Game Status */}
        <div className="mt-2 text-center">
          {gameState.trucoLevel > 0 && (
            <div className="text-red-400 text-xs">
              {gameState.trucoLevel === 1 && "Truco"}
              {gameState.trucoLevel === 2 && "Retruco"}
              {gameState.trucoLevel === 3 && "Vale Cuatro"}
            </div>
          )}
          {gameState.envidoLevel > 0 && (
            <div className="text-blue-400 text-xs">
              {gameState.envidoLevel === 1 && "Envido"}
              {gameState.envidoLevel === 2 && "Real Envido"}
              {gameState.envidoLevel === 3 && "Falta Envido"}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
