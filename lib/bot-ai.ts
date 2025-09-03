import type { GameState, GameAction, Card } from "./types"
import { calculateEnvido, compareCards } from "./cards"

export class TrucoBot {
  private difficulty: "easy" | "medium" | "hard"

  constructor(difficulty: "easy" | "medium" | "hard" = "medium") {
    this.difficulty = difficulty
  }

  public getNextAction(gameState: GameState): GameAction {
    const botPlayer = gameState.players[1]
    const playerScore = gameState.players[0].score
    const botScore = botPlayer.score

    // If waiting for response to a bet
    if (gameState.waitingForResponse && gameState.pendingAction) {
      return this.decideBetResponse(gameState)
    }

    // Decide whether to sing envido (only on first baza)
    if (gameState.currentBaza === 0 && gameState.envidoLevel === 0 && gameState.table.length === 0) {
      const envidoAction = this.considerEnvido(gameState)
      if (envidoAction) return envidoAction
    }

    // Decide whether to sing truco
    if (gameState.trucoLevel === 0 && gameState.table.length === 0) {
      const trucoAction = this.considerTruco(gameState)
      if (trucoAction) return trucoAction
    }

    // Play a card
    return this.selectCard(gameState)
  }

  private decideBetResponse(gameState: GameState): GameAction {
    const action = gameState.pendingAction!
    const botHand = gameState.players[1].hand
    const playerScore = gameState.players[0].score
    const botScore = gameState.players[1].score

    // Envido response logic
    if (action.type.includes("ENVIDO")) {
      const botEnvido = calculateEnvido(botHand)
      const acceptChance = this.getEnvidoAcceptChance(botEnvido, gameState)

      if (Math.random() < acceptChance) {
        return { type: "ACCEPT" }
      } else {
        return { type: "REJECT" }
      }
    }

    // Truco response logic
    if (action.type.includes("TRUCO") || action.type.includes("RETRUCO") || action.type.includes("VALE")) {
      const handStrength = this.evaluateHandStrength(botHand, gameState)
      const acceptChance = this.getTrucoAcceptChance(handStrength, gameState)

      if (Math.random() < acceptChance) {
        return { type: "ACCEPT" }
      } else {
        return { type: "REJECT" }
      }
    }

    return { type: "REJECT" }
  }

  private considerEnvido(gameState: GameState): GameAction | null {
    const botHand = gameState.players[1].hand
    const botEnvido = calculateEnvido(botHand)
    const playerScore = gameState.players[0].score
    const botScore = gameState.players[1].score

    // Don't sing envido if close to winning without it
    if (botScore >= 28) return null

    // Sing envido based on hand strength and game situation
    let singChance = 0

    if (botEnvido >= 30) {
      singChance = 0.8 // Very strong envido
    } else if (botEnvido >= 27) {
      singChance = 0.6 // Good envido
    } else if (botEnvido >= 24) {
      singChance = 0.3 // Decent envido
    } else {
      singChance = 0.1 // Weak envido, rarely sing
    }

    // Adjust based on difficulty
    singChance *= this.getDifficultyMultiplier()

    // More aggressive when behind
    if (botScore < playerScore - 5) {
      singChance *= 1.5
    }

    if (Math.random() < singChance) {
      // Choose envido type based on situation
      if (botEnvido >= 31 && Math.random() < 0.3) {
        return { type: "SING_REAL_ENVIDO" }
      }
      return { type: "SING_ENVIDO" }
    }

    return null
  }

  private considerTruco(gameState: GameState): GameAction | null {
    const botHand = gameState.players[1].hand
    const handStrength = this.evaluateHandStrength(botHand, gameState)
    const playerScore = gameState.players[0].score
    const botScore = gameState.players[1].score

    let singChance = 0

    // Base chance on hand strength
    if (handStrength >= 0.8) {
      singChance = 0.7 // Very strong hand
    } else if (handStrength >= 0.6) {
      singChance = 0.4 // Good hand
    } else if (handStrength >= 0.4) {
      singChance = 0.2 // Decent hand
    } else {
      singChance = 0.05 // Weak hand, bluff occasionally
    }

    // Adjust based on difficulty
    singChance *= this.getDifficultyMultiplier()

    // More aggressive when behind
    if (botScore < playerScore - 3) {
      singChance *= 1.3
    }

    // Less aggressive when ahead
    if (botScore > playerScore + 5) {
      singChance *= 0.7
    }

    if (Math.random() < singChance) {
      return { type: "SING_TRUCO" }
    }

    return null
  }

  private selectCard(gameState: GameState): GameAction {
    const botHand = gameState.players[1].hand
    const tableCards = gameState.table

    // If bot plays first
    if (tableCards.length === 0) {
      return this.selectFirstCard(botHand, gameState)
    }

    // If bot plays second (responding to player's card)
    const playerCard = tableCards[0]
    return this.selectResponseCard(botHand, playerCard, gameState)
  }

  private selectFirstCard(hand: Card[], gameState: GameState): GameAction {
    // Strategy: Play medium strength cards first, save strong cards for later bazas
    const cardStrengths = hand.map((card, index) => ({
      index,
      strength: card.trucoValue,
      card,
    }))

    cardStrengths.sort((a, b) => a.strength - b.strength)

    // On first baza, play a medium card if available
    if (gameState.currentBaza === 0) {
      const mediumCardIndex = Math.floor(cardStrengths.length / 2)
      return { type: "PLAY_CARD", cardIndex: cardStrengths[mediumCardIndex].index }
    }

    // On later bazas, be more strategic based on previous results
    const bazaWins = [0, 0]
    gameState.bazas.forEach((baza) => {
      bazaWins[baza.winner]++
    })

    // If bot is winning, play conservatively
    if (bazaWins[1] > bazaWins[0]) {
      return { type: "PLAY_CARD", cardIndex: cardStrengths[0].index } // Weakest card
    }

    // If bot needs to win, play stronger card
    return { type: "PLAY_CARD", cardIndex: cardStrengths[cardStrengths.length - 1].index } // Strongest card
  }

  private selectResponseCard(hand: Card[], playerCard: Card, gameState: GameState): GameAction {
    const cardStrengths = hand.map((card, index) => ({
      index,
      strength: card.trucoValue,
      card,
      canWin: compareCards(card, playerCard) > 0,
    }))

    // Find cards that can win
    const winningCards = cardStrengths.filter((c) => c.canWin)

    if (winningCards.length > 0) {
      // Play the weakest card that can win
      winningCards.sort((a, b) => a.strength - b.strength)
      return { type: "PLAY_CARD", cardIndex: winningCards[0].index }
    }

    // No winning cards, play the weakest card
    cardStrengths.sort((a, b) => a.strength - b.strength)
    return { type: "PLAY_CARD", cardIndex: cardStrengths[0].index }
  }

  private evaluateHandStrength(hand: Card[], gameState: GameState): number {
    // Calculate overall hand strength (0-1)
    const totalTrucoValue = hand.reduce((sum, card) => sum + card.trucoValue, 0)
    const maxPossibleValue = 14 + 13 + 12 // Best possible hand values

    let strength = totalTrucoValue / maxPossibleValue

    // Bonus for having very strong cards
    const hasAncho = hand.some((card) => card.trucoValue >= 13)
    const hasSiete = hand.some((card) => card.trucoValue >= 11)

    if (hasAncho) strength += 0.1
    if (hasSiete) strength += 0.05

    return Math.min(strength, 1)
  }

  private getEnvidoAcceptChance(envidoValue: number, gameState: GameState): number {
    let baseChance = 0

    if (envidoValue >= 30) {
      baseChance = 0.9
    } else if (envidoValue >= 27) {
      baseChance = 0.7
    } else if (envidoValue >= 24) {
      baseChance = 0.5
    } else if (envidoValue >= 20) {
      baseChance = 0.3
    } else {
      baseChance = 0.1
    }

    return baseChance * this.getDifficultyMultiplier()
  }

  private getTrucoAcceptChance(handStrength: number, gameState: GameState): number {
    let baseChance = handStrength * 0.8 // Base on hand strength

    // Adjust based on game situation
    const playerScore = gameState.players[0].score
    const botScore = gameState.players[1].score

    if (botScore < playerScore - 5) {
      baseChance += 0.2 // More willing to accept when behind
    }

    if (botScore > playerScore + 5) {
      baseChance -= 0.1 // Less willing when ahead
    }

    return Math.max(0.1, Math.min(0.9, baseChance * this.getDifficultyMultiplier()))
  }

  private getDifficultyMultiplier(): number {
    switch (this.difficulty) {
      case "easy":
        return 0.7 // Less optimal play
      case "medium":
        return 1.0 // Standard play
      case "hard":
        return 1.2 // More aggressive/optimal play
      default:
        return 1.0
    }
  }

  public shouldGoToDeck(gameState: GameState): boolean {
    const botHand = gameState.players[1].hand
    const handStrength = this.evaluateHandStrength(botHand, gameState)
    const playerScore = gameState.players[0].score
    const botScore = gameState.players[1].score

    // Very weak hand and high stakes
    if (handStrength < 0.2 && gameState.trucoLevel >= 2) {
      return Math.random() < 0.4
    }

    // When very close to losing
    if (playerScore >= 28 && gameState.handPoints >= 2) {
      return handStrength < 0.3 && Math.random() < 0.3
    }

    return false
  }
}

// Utility function to add delay for more realistic bot behavior
export function addBotDelay(callback: () => void, baseDelay = 1000): void {
  const randomDelay = baseDelay + Math.random() * 1000 // 1-2 seconds
  setTimeout(callback, randomDelay)
}
