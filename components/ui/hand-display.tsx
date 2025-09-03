"use client"

import type { Card } from "@/lib/types"
import CardComponent from "./card-component"
import { cn } from "@/lib/utils"

interface HandDisplayProps {
  cards: Card[]
  isPlayerHand?: boolean
  onCardClick?: (cardIndex: number) => void
  selectedCardIndex?: number
  className?: string
}

export default function HandDisplay({
  cards,
  isPlayerHand = false,
  onCardClick,
  selectedCardIndex,
  className,
}: HandDisplayProps) {
  return (
    <div className={cn("flex gap-1 sm:gap-2 justify-center overflow-x-auto px-2", className)}>
      {cards.map((card, index) => (
        <CardComponent
          key={`${card.suit}-${card.value}`}
          card={card}
          isPlayable={isPlayerHand}
          isSelected={selectedCardIndex === index}
          onClick={() => onCardClick?.(index)}
        />
      ))}
    </div>
  )
}
