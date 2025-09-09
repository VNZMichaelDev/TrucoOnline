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
    <div className={cn("relative w-full h-full flex items-center justify-center", className)}>
      {/* Mesa ovalada de truco */}
      <div className="relative w-[600px] h-[400px]">
        {/* Superficie principal de la mesa */}
        <div 
          className="absolute inset-0 rounded-full shadow-2xl"
          style={{
            background: `
              radial-gradient(ellipse at center, #0f5132 0%, #0a3d26 40%, #052e1f 80%, #031a13 100%)
            `,
            boxShadow: `
              inset 0 0 80px rgba(0,0,0,0.4),
              0 25px 50px rgba(0,0,0,0.6),
              0 0 0 8px #1a5e42,
              0 0 0 12px #0f3d2a
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
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-3">
          <div className="bg-black/30 backdrop-blur-sm px-4 py-1.5 rounded-full border border-emerald-400/40">
            <span className="text-emerald-100 text-sm font-semibold">{opponentName}</span>
          </div>
          <div className="relative">
            {opponentCard ? (
              <div className="transform hover:scale-110 transition-all duration-200 drop-shadow-xl">
                <CardComponent card={opponentCard} isOnTable />
              </div>
            ) : (
              <div className="w-16 h-24 bg-emerald-900/30 border border-dashed border-emerald-400/50 rounded-lg flex items-center justify-center">
                <span className="text-emerald-300/70 text-xs">...</span>
              </div>
            )}
          </div>
        </div>

        {/* Área de cartas - Jugador (abajo) */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-3">
          <div className="relative">
            {playerCard ? (
              <div className="transform hover:scale-110 transition-all duration-200 drop-shadow-xl">
                <CardComponent card={playerCard} isOnTable />
              </div>
            ) : (
              <div className="w-16 h-24 bg-emerald-900/30 border border-dashed border-emerald-400/50 rounded-lg flex items-center justify-center animate-pulse">
                <span className="text-emerald-300/70 text-xs">Tu turno</span>
              </div>
            )}
          </div>
          <div className="bg-black/30 backdrop-blur-sm px-4 py-1.5 rounded-full border border-emerald-400/40">
            <span className="text-emerald-100 text-sm font-semibold">{playerName}</span>
          </div>
        </div>

        {/* Marca central decorativa */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="w-12 h-12 bg-emerald-800/40 rounded-full border-2 border-emerald-600/30 flex items-center justify-center">
            <div className="w-6 h-6 bg-emerald-700/50 rounded-full"></div>
          </div>
        </div>

        {/* Efectos de luz ambiental */}
        <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 w-40 h-20 bg-emerald-400/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 left-1/2 transform -translate-x-1/2 w-48 h-24 bg-emerald-300/5 rounded-full blur-3xl"></div>
        
        {/* Brillo superior */}
        <div className="absolute top-0 left-0 w-full h-1/2 rounded-t-full bg-gradient-to-b from-emerald-300/8 to-transparent pointer-events-none"></div>
      </div>
    </div>
  )
}
