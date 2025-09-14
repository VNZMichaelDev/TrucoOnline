"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface EnvidoResultModalProps {
  player1Name: string
  player2Name: string
  player1Points: number
  player2Points: number
  winner: number
  pointsAwarded: number
  onClose: () => void
}

export default function EnvidoResultModal({
  player1Name,
  player2Name,
  player1Points,
  player2Points,
  winner,
  pointsAwarded,
  onClose
}: EnvidoResultModalProps) {
  const winnerName = winner === 0 ? player1Name : player2Name

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-80 bg-gradient-to-br from-blue-900 to-purple-900 border-2 border-blue-400">
        <CardContent className="p-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">¡Envido!</h2>
          
          <div className="space-y-3 mb-6">
            <div className={`p-3 rounded-lg ${winner === 0 ? 'bg-green-600/30 border-2 border-green-400' : 'bg-gray-600/30'}`}>
              <div className="text-white font-semibold">{player1Name}</div>
              <div className="text-2xl font-bold text-yellow-400">{player1Points} puntos</div>
            </div>
            
            <div className={`p-3 rounded-lg ${winner === 1 ? 'bg-green-600/30 border-2 border-green-400' : 'bg-gray-600/30'}`}>
              <div className="text-white font-semibold">{player2Name}</div>
              <div className="text-2xl font-bold text-yellow-400">{player2Points} puntos</div>
            </div>
          </div>
          
          <div className="mb-6">
            <div className="text-green-400 font-bold text-lg">¡Gana {winnerName}!</div>
            <div className="text-white">+{pointsAwarded} puntos</div>
          </div>
          
          <Button 
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            Continuar
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
