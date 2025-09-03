"use client"

import type { Card } from "@/lib/types"
import CardComponent from "./card-component"
import { cn } from "@/lib/utils"

interface TableDisplayProps {
  playerCard?: Card
  botCard?: Card
  className?: string
}

export default function TableDisplay({ playerCard, botCard, className }: TableDisplayProps) {
  return (
    <div className={cn("flex items-center justify-center gap-8 min-h-32", className)}>
      {/* Bot's played card */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-amber-200 text-sm font-medium">Bot</span>
        {botCard ? (
          <CardComponent card={botCard} isOnTable />
        ) : (
          <div className="w-12 h-18 md:w-16 md:h-24 border-2 border-dashed border-amber-600/50 rounded-lg flex items-center justify-center">
            <span className="text-amber-600/50 text-xs">Esperando</span>
          </div>
        )}
      </div>

      {/* Player's played card */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-amber-200 text-sm font-medium">Tú</span>
        {playerCard ? (
          <CardComponent card={playerCard} isOnTable />
        ) : (
          <div className="w-12 h-18 md:w-16 md:h-24 border-2 border-dashed border-amber-600/50 rounded-lg flex items-center justify-center">
            <span className="text-amber-600/50 text-xs">Juega</span>
          </div>
        )}
      </div>
    </div>
  )
}
