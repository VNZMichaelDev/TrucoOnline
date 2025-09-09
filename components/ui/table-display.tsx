"use client"

import type { Card } from "@/lib/types"
import CardComponent from "./card-component"
import { cn } from "@/lib/utils"

interface TableDisplayProps {
  playerCard?: Card
  opponentCard?: Card
  opponentName?: string
  playerName?: string
  className?: string
}

export default function TableDisplay({
  playerCard,
  opponentCard,
  opponentName = "Oponente",
  playerName = "Tú",
  className,
}: TableDisplayProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Mesa de juego con efecto de madera */}
      <div className="relative bg-gradient-to-br from-amber-900 via-amber-800 to-amber-900 rounded-3xl p-8 shadow-2xl border-4 border-amber-700">
        {/* Textura de madera */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-700/20 to-transparent rounded-3xl"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-amber-700/10 via-transparent to-amber-900/20 rounded-3xl"></div>
        
        {/* Área central de juego */}
        <div className="relative flex items-center justify-center gap-12 min-h-40">
          {/* Carta del oponente */}
          <div className="flex flex-col items-center gap-3">
            <div className="bg-amber-800/50 px-3 py-1 rounded-full border border-amber-600">
              <span className="text-amber-100 text-sm font-semibold">{opponentName}</span>
            </div>
            {opponentCard ? (
              <div className="transform hover:scale-105 transition-transform duration-200">
                <CardComponent card={opponentCard} isOnTable />
              </div>
            ) : (
              <div className="w-16 h-24 md:w-20 md:h-28 bg-gradient-to-br from-amber-700/30 to-amber-900/30 border-2 border-dashed border-amber-500/50 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <span className="text-amber-300/70 text-xs font-medium">Esperando...</span>
              </div>
            )}
          </div>

          {/* Separador visual */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-1 h-8 bg-gradient-to-b from-amber-600 to-amber-800 rounded-full"></div>
            <div className="w-8 h-8 bg-gradient-to-br from-amber-600 to-amber-800 rounded-full shadow-lg flex items-center justify-center">
              <div className="w-4 h-4 bg-amber-400 rounded-full"></div>
            </div>
            <div className="w-1 h-8 bg-gradient-to-b from-amber-800 to-amber-600 rounded-full"></div>
          </div>

          {/* Carta del jugador */}
          <div className="flex flex-col items-center gap-3">
            <div className="bg-amber-800/50 px-3 py-1 rounded-full border border-amber-600">
              <span className="text-amber-100 text-sm font-semibold">{playerName}</span>
            </div>
            {playerCard ? (
              <div className="transform hover:scale-105 transition-transform duration-200">
                <CardComponent card={playerCard} isOnTable />
              </div>
            ) : (
              <div className="w-16 h-24 md:w-20 md:h-28 bg-gradient-to-br from-amber-700/30 to-amber-900/30 border-2 border-dashed border-amber-500/50 rounded-xl flex items-center justify-center backdrop-blur-sm animate-pulse">
                <span className="text-amber-300/70 text-xs font-medium">Tu turno</span>
              </div>
            )}
          </div>
        </div>

        {/* Efectos de luz */}
        <div className="absolute top-4 left-4 w-16 h-16 bg-amber-400/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-4 right-4 w-20 h-20 bg-amber-600/10 rounded-full blur-xl"></div>
      </div>
    </div>
  )
}
