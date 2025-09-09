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
    <div className={cn("relative w-full h-full flex items-center justify-center px-4", className)}>
      {/* Mesa ovalada de truco - Responsiva */}
      <div className="relative w-full max-w-sm sm:max-w-md md:max-w-lg aspect-[3/2]">
        {/* Superficie principal de la mesa */}
        <div 
          className="absolute inset-0 rounded-full shadow-xl sm:shadow-2xl"
          style={{
            background: `
              radial-gradient(ellipse at center, #0f5132 0%, #0a3d26 40%, #052e1f 80%, #031a13 100%)
            `,
            boxShadow: `
              inset 0 0 40px rgba(0,0,0,0.4),
              0 15px 30px rgba(0,0,0,0.6),
              0 0 0 4px #1a5e42,
              0 0 0 6px #0f3d2a
            `
          }}
        >
          {/* Textura de fieltro sutil */}
          <div 
            className="absolute inset-0 rounded-full opacity-20"
            style={{
              background: `
                repeating-conic-gradient(
                  from 0deg at 50% 50%,
                  transparent 0deg,
                  rgba(255,255,255,0.02) 1deg,
                  transparent 2deg
                )
              `
            }}
          />
        </div>

        {/* Área de cartas - Oponente (arriba) */}
        <div className="absolute top-3 sm:top-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="bg-black/30 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-full border border-emerald-400/40">
            <span className="text-emerald-100 text-xs sm:text-sm font-semibold truncate max-w-20 sm:max-w-none">{opponentName}</span>
          </div>
          <div className="relative">
            {opponentCard ? (
              <div className="transform hover:scale-105 sm:hover:scale-110 transition-all duration-200 drop-shadow-lg">
                <div className="scale-75 sm:scale-90 md:scale-100">
                  <CardComponent card={opponentCard} isOnTable />
                </div>
              </div>
            ) : (
              <div className="w-12 h-18 sm:w-14 sm:h-20 md:w-16 md:h-24 bg-emerald-900/30 border border-dashed border-emerald-400/50 rounded-lg flex items-center justify-center">
                <span className="text-emerald-300/70 text-xs">...</span>
              </div>
            )}
          </div>
        </div>

        {/* Área de cartas - Jugador (abajo) */}
        <div className="absolute bottom-3 sm:bottom-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="relative">
            {playerCard ? (
              <div className="transform hover:scale-105 sm:hover:scale-110 transition-all duration-200 drop-shadow-lg">
                <div className="scale-75 sm:scale-90 md:scale-100">
                  <CardComponent card={playerCard} isOnTable />
                </div>
              </div>
            ) : (
              <div className="w-12 h-18 sm:w-14 sm:h-20 md:w-16 md:h-24 bg-emerald-900/30 border border-dashed border-emerald-400/50 rounded-lg flex items-center justify-center animate-pulse">
                <span className="text-emerald-300/70 text-xs">Tu turno</span>
              </div>
            )}
          </div>
          <div className="bg-black/30 backdrop-blur-sm px-2 sm:px-3 py-1 rounded-full border border-emerald-400/40">
            <span className="text-emerald-100 text-xs sm:text-sm font-semibold truncate max-w-20 sm:max-w-none">{playerName}</span>
          </div>
        </div>

        {/* Marca central decorativa */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-emerald-800/40 rounded-full border-2 border-emerald-600/30 flex items-center justify-center">
            <div className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 bg-emerald-700/50 rounded-full"></div>
          </div>
        </div>

        {/* Efectos de luz ambiental - Reducidos para móvil */}
        <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 w-24 h-12 sm:w-32 sm:h-16 md:w-40 md:h-20 bg-emerald-400/5 rounded-full blur-2xl sm:blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/2 transform -translate-x-1/2 w-28 h-14 sm:w-36 sm:h-18 md:w-48 md:h-24 bg-emerald-300/5 rounded-full blur-2xl sm:blur-3xl"></div>
        
        {/* Brillo superior */}
        <div className="absolute top-0 left-0 w-full h-1/2 rounded-t-full bg-gradient-to-b from-emerald-300/8 to-transparent pointer-events-none"></div>
      </div>
    </div>
  )
}
