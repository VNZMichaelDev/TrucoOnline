"use client"

import { useCallback, useRef } from "react"
import { TrucoBot, addBotDelay } from "@/lib/bot-ai"
import type { GameState, GameAction } from "@/lib/types"

export function useBotAI(difficulty: "easy" | "medium" | "hard" = "medium") {
  const botRef = useRef<TrucoBot>(new TrucoBot(difficulty))

  const getBotAction = useCallback(
    (gameState: GameState, onAction: (action: GameAction) => void) => {
      // Only act if it's bot's turn
      if (gameState.currentPlayer !== 1 || gameState.phase === "finished") {
        return
      }

      // Check if bot should go to deck first
      if (botRef.current.shouldGoToDeck(gameState)) {
        addBotDelay(() => {
          onAction({ type: "GO_TO_DECK" })
        }, 1500)
        return
      }

      // Get bot's next action
      const action = botRef.current.getNextAction(gameState)

      // Add realistic delay based on action type
      let delay = 1000

      if (action.type.includes("TRUCO") || action.type.includes("ENVIDO")) {
        delay = 2000 // Longer delay for betting decisions
      } else if (action.type === "ACCEPT" || action.type === "REJECT") {
        delay = 1500 // Medium delay for responses
      }

      addBotDelay(() => {
        onAction(action)
      }, delay)
    },
    [difficulty],
  )

  const resetBot = useCallback(() => {
    botRef.current = new TrucoBot(difficulty)
  }, [difficulty])

  return {
    getBotAction,
    resetBot,
  }
}
