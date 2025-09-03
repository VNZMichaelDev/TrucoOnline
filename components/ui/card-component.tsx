"use client"

import type { Card } from "@/lib/types"
import { getCardDisplayName } from "@/lib/cards"
import { cn } from "@/lib/utils"

interface CardComponentProps {
  card: Card
  isPlayable?: boolean
  isSelected?: boolean
  isOnTable?: boolean
  onClick?: () => void
  className?: string
}

export default function CardComponent({
  card,
  isPlayable = false,
  isSelected = false,
  isOnTable = false,
  onClick,
  className,
}: CardComponentProps) {
  return (
    <div
      className={cn(
        "relative cursor-pointer transition-all duration-200 select-none",
        "w-20 h-28 sm:w-24 sm:h-32 md:w-28 md:h-36",
        isPlayable && "hover:scale-105 hover:-translate-y-2 active:scale-95",
        isSelected && "scale-105 -translate-y-2 ring-4 ring-amber-400 shadow-2xl",
        isOnTable && "w-16 h-22 sm:w-20 sm:h-28",
        !isPlayable && "cursor-default",
        className,
      )}
      onClick={isPlayable ? onClick : undefined}
      title={getCardDisplayName(card)}
    >
      <img
        src={card.imageUrl || "/placeholder.svg"}
        alt={getCardDisplayName(card)}
        className="w-full h-full object-cover rounded-lg shadow-lg border-2 border-amber-600/50"
        loading="lazy"
      />
      {isSelected && <div className="absolute inset-0 bg-amber-400/30 rounded-lg border-2 border-amber-300" />}
    </div>
  )
}
