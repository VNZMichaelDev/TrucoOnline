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
    <div className={cn("relative", className)}>
      {/* Área de cartas con efecto de abanico */}
      <div className="flex justify-center items-end gap-1 sm:gap-2 px-4 py-2">
        {cards.map((card, index) => {
          const totalCards = cards.length
          const centerIndex = (totalCards - 1) / 2
          const offsetFromCenter = index - centerIndex
          const rotation = offsetFromCenter * 8 // 8 grados por carta
          const yOffset = Math.abs(offsetFromCenter) * 2 // Elevación hacia el centro
          
          return (
            <div
              key={`${card.suit}-${card.value}`}
              className="relative transition-all duration-300 hover:scale-110 hover:-translate-y-4 hover:z-10"
              style={{
                transform: `rotate(${rotation}deg) translateY(${yOffset}px)`,
                zIndex: selectedCardIndex === index ? 20 : 10 - Math.abs(offsetFromCenter)
              }}
            >
              <CardComponent
                card={card}
                isPlayable={isPlayerHand}
                isSelected={selectedCardIndex === index}
                onClick={() => onCardClick?.(index)}
              />
              {/* Sombra de carta */}
              <div 
                className="absolute inset-0 bg-black/20 rounded-lg blur-sm -z-10"
                style={{
                  transform: `translateY(4px) translateX(2px)`
                }}
              />
            </div>
          )
        })}
      </div>
      
      {/* Indicador de mano del jugador */}
      {isPlayerHand && (
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
          <div className="bg-amber-600/80 text-amber-100 text-xs px-3 py-1 rounded-full border border-amber-500">
            Tu mano
          </div>
        </div>
      )}
    </div>
  )
}
