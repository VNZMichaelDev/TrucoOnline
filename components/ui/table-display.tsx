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
    <div className={cn("relative w-full max-w-4xl mx-auto", className)}>
      {/* Mesa de truco realista */}
      <div className="relative">
        {/* Superficie de la mesa con textura de madera */}
        <div 
          className="relative bg-gradient-to-br from-green-800 via-green-700 to-green-900 rounded-[2rem] p-12 shadow-2xl"
          style={{
            background: `
              radial-gradient(ellipse at center, #1f4f3f 0%, #0f2f1f 70%),
              linear-gradient(45deg, #2d5a3d 0%, #1a3d2a 50%, #0d2d1a 100%)
            `,
            boxShadow: `
              inset 0 0 50px rgba(0,0,0,0.3),
              0 20px 40px rgba(0,0,0,0.4),
              0 0 0 3px #2d5a3d,
              0 0 0 6px #1a3d2a
            `
          }}
        >
          {/* Textura de fieltro */}
          <div 
            className="absolute inset-0 rounded-[2rem] opacity-30"
            style={{
              background: `
                repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 1px,
                  rgba(255,255,255,0.03) 1px,
                  rgba(255,255,255,0.03) 2px
                ),
                repeating-linear-gradient(
                  -45deg,
                  transparent,
                  transparent 1px,
                  rgba(255,255,255,0.02) 1px,
                  rgba(255,255,255,0.02) 2px
                )
              `
            }}
          />

          {/* Área de juego central */}
          <div className="relative flex items-center justify-between min-h-32">
            {/* Zona del oponente */}
            <div className="flex flex-col items-center gap-4">
              <div className="bg-black/20 backdrop-blur-sm px-4 py-2 rounded-full border border-green-400/30">
                <span className="text-green-100 text-sm font-bold tracking-wide">{opponentName}</span>
              </div>
              <div className="relative">
                {opponentCard ? (
                  <div className="transform hover:scale-105 transition-all duration-300 drop-shadow-2xl">
                    <CardComponent card={opponentCard} isOnTable />
                  </div>
                ) : (
                  <div className="w-20 h-28 bg-gradient-to-br from-green-600/20 to-green-900/40 border-2 border-dashed border-green-400/40 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <span className="text-green-200/60 text-xs font-medium">Esperando</span>
                  </div>
                )}
              </div>
            </div>

            {/* Centro de la mesa */}
            <div className="flex flex-col items-center justify-center gap-3">
              {/* Marca central de la mesa */}
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-green-600/30 to-green-900/50 rounded-full border-2 border-green-400/20 flex items-center justify-center backdrop-blur-sm">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-400/40 to-green-600/60 rounded-full shadow-inner">
                    <div className="w-full h-full bg-gradient-to-tr from-transparent to-green-300/20 rounded-full"></div>
                  </div>
                </div>
                {/* Líneas decorativas */}
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-px h-6 bg-gradient-to-b from-transparent to-green-400/30"></div>
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 w-px h-6 bg-gradient-to-t from-transparent to-green-400/30"></div>
                <div className="absolute -left-8 top-1/2 transform -translate-y-1/2 h-px w-6 bg-gradient-to-r from-transparent to-green-400/30"></div>
                <div className="absolute -right-8 top-1/2 transform -translate-y-1/2 h-px w-6 bg-gradient-to-l from-transparent to-green-400/30"></div>
              </div>
            </div>

            {/* Zona del jugador */}
            <div className="flex flex-col items-center gap-4">
              <div className="bg-black/20 backdrop-blur-sm px-4 py-2 rounded-full border border-green-400/30">
                <span className="text-green-100 text-sm font-bold tracking-wide">{playerName}</span>
              </div>
              <div className="relative">
                {playerCard ? (
                  <div className="transform hover:scale-105 transition-all duration-300 drop-shadow-2xl">
                    <CardComponent card={playerCard} isOnTable />
                  </div>
                ) : (
                  <div className="w-20 h-28 bg-gradient-to-br from-green-600/20 to-green-900/40 border-2 border-dashed border-green-400/40 rounded-lg flex items-center justify-center backdrop-blur-sm animate-pulse">
                    <span className="text-green-200/60 text-xs font-medium">Tu turno</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Efectos de iluminación */}
          <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-32 h-16 bg-green-300/5 rounded-full blur-2xl"></div>
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-40 h-20 bg-green-400/5 rounded-full blur-3xl"></div>
          
          {/* Reflejos en los bordes */}
          <div className="absolute top-0 left-0 w-full h-full rounded-[2rem] bg-gradient-to-br from-green-300/10 via-transparent to-transparent pointer-events-none"></div>
        </div>

        {/* Sombra de la mesa */}
        <div className="absolute inset-0 bg-black/20 rounded-[2rem] blur-xl transform translate-y-2 -z-10"></div>
      </div>
    </div>
  )
}
