import type { GameState, GameAction, BettingState } from "./types"
import { createDeck, dealCards, compareCards, calculateEnvido } from "./cards"

export class TrucoEngine {
  private gameState: GameState

  constructor(playerName: string) {
    this.gameState = this.initializeGame(playerName)
  }

  private initializeGame(playerName: string): GameState {
    const deck = createDeck()
    const [playerHand, botHand] = dealCards(deck)

    return {
      players: [
        {
          id: "player",
          name: playerName,
          hand: playerHand,
          score: 0,
          isBot: false,
        },
        {
          id: "bot",
          name: "Bot",
          hand: botHand,
          score: 0,
          isBot: true,
        },
      ],
      currentPlayer: 0,
      phase: "playing",
      table: [],
      bazas: [],
      trucoLevel: 0,
      trucoAccepted: false,
      envidoLevel: 0,
      envidoAccepted: false,
      envidoPoints: 0,
      gamePoints: 0,
      handPoints: 1,
      currentBaza: 0,
      lastWinner: 0,
      waitingForResponse: false,
      mano: 0, // Player who starts the hand (rotates each hand)
    }
  }

  public getGameState(): GameState {
    return { ...this.gameState }
  }

  public getBettingState(): BettingState {
    const currentPlayer = this.gameState.players[this.gameState.currentPlayer]
    const isFirstBaza = this.gameState.currentBaza === 0
    const hasPlayedCard = this.gameState.table.length > 0

    return {
      canSingTruco: !this.gameState.waitingForResponse && this.gameState.trucoLevel < 3 && !hasPlayedCard,
      canSingEnvido:
        !this.gameState.waitingForResponse && this.gameState.envidoLevel === 0 && isFirstBaza && !hasPlayedCard,
      canAccept: this.gameState.waitingForResponse && !currentPlayer.isBot,
      canReject: this.gameState.waitingForResponse && !currentPlayer.isBot,
      canGoToDeck: !this.gameState.waitingForResponse,
    }
  }

  public processAction(action: GameAction): GameState {
    switch (action.type) {
      case "PLAY_CARD":
        return this.playCard(action.cardIndex)
      case "SING_TRUCO":
        return this.singTruco()
      case "SING_RETRUCO":
        return this.singRetruco()
      case "SING_VALE_CUATRO":
        return this.singValeCuatro()
      case "SING_ENVIDO":
        return this.singEnvido()
      case "SING_REAL_ENVIDO":
        return this.singRealEnvido()
      case "SING_FALTA_ENVIDO":
        return this.singFaltaEnvido()
      case "ACCEPT":
        return this.acceptBet()
      case "REJECT":
        return this.rejectBet()
      case "GO_TO_DECK":
        return this.goToDeck()
      case "START_NEW_HAND":
        return this.startNewHand()
      default:
        return this.gameState
    }
  }

  private playCard(cardIndex: number): GameState {
    const currentPlayer = this.gameState.players[this.gameState.currentPlayer]

    if (cardIndex < 0 || cardIndex >= currentPlayer.hand.length) {
      return this.gameState
    }

    const playedCard = currentPlayer.hand[cardIndex]

    // Remove card from hand
    currentPlayer.hand.splice(cardIndex, 1)

    // Add card to table
    this.gameState.table.push(playedCard)

    // If both players have played, resolve baza
    if (this.gameState.table.length === 2) {
      this.resolveBaza()
    } else {
      // Switch to other player
      this.gameState.currentPlayer = 1 - this.gameState.currentPlayer
    }

    return this.gameState
  }

  private resolveBaza(): void {
    const [card1, card2] = this.gameState.table
    const comparison = compareCards(card2, card1)

    let winner: number
    let isParda = false

    if (comparison > 0) {
      winner = 1 // Second player wins
    } else if (comparison < 0) {
      winner = 0 // First player wins
    } else {
      isParda = true

      // Parda logic:
      // - If first baza is parda, whoever wins second baza wins the hand
      // - If second baza is parda, whoever won first baza wins the hand
      // - If all three bazas are parda, the "mano" (hand starter) wins

      if (this.gameState.currentBaza === 0) {
        // First baza parda - continue playing, winner will be determined by next baza
        winner = this.gameState.lastWinner // Temporary, will be overridden
      } else if (this.gameState.currentBaza === 1) {
        // Second baza parda - first baza winner takes the hand
        const firstBazaWinner = this.gameState.bazas[0]?.winner ?? 0
        winner = firstBazaWinner
      } else {
        // Third baza parda - mano (hand starter) wins
        winner = this.gameState.mano ?? 0
      }
    }

    // Record baza result
    this.gameState.bazas.push({
      winner,
      cards: [...this.gameState.table],
      isParda,
    })

    // Clear table
    this.gameState.table = []

    // Update game state
    if (!isParda || this.gameState.currentBaza > 0) {
      this.gameState.lastWinner = winner
    }

    this.gameState.currentBaza++
    this.gameState.currentPlayer = winner

    // Check if hand is finished with correct logic
    if (this.isHandFinished()) {
      this.finishHand()
    }
  }

  private isHandFinished(): boolean {
    const bazaWins = [0, 0]
    let pardas = 0

    this.gameState.bazas.forEach((baza) => {
      if (baza.isParda) {
        pardas++
      } else {
        bazaWins[baza.winner]++
      }
    })

    // Hand ends when someone wins 2 bazas
    if (bazaWins[0] >= 2 || bazaWins[1] >= 2) {
      return true
    }

    // Special parda cases
    if (this.gameState.bazas.length >= 3) {
      return true // All three bazas played
    }

    // If first baza was parda and second baza is decided, hand ends
    if (this.gameState.bazas.length >= 2 && this.gameState.bazas[0].isParda && !this.gameState.bazas[1].isParda) {
      return true
    }

    return false
  }

  private finishHand(): void {
    const bazaWins = [0, 0]

    this.gameState.bazas.forEach((baza) => {
      bazaWins[baza.winner]++
    })

    const handWinner = bazaWins[0] > bazaWins[1] ? 0 : 1
    let points = this.gameState.handPoints

    // Add truco points if accepted
    if (this.gameState.trucoAccepted) {
      points = this.getTrucoPoints()
    }

    // Add envido points if played
    if (this.gameState.envidoAccepted && this.gameState.envidoPoints > 0) {
      points += this.getEnvidoPoints()
    }

    this.gameState.players[handWinner].score += points

    // Check if game is finished (30 points)
    if (this.gameState.players[handWinner].score >= 30) {
      this.gameState.phase = "finished"
    } else {
      this.gameState.phase = "hand-result"
    }
  }

  private singTruco(): GameState {
    if (this.gameState.trucoLevel === 0) {
      this.gameState.trucoLevel = 1
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_TRUCO" }
      this.gameState.currentPlayer = 1 - this.gameState.currentPlayer
    }
    return this.gameState
  }

  private singRetruco(): GameState {
    if (this.gameState.trucoLevel === 1) {
      this.gameState.trucoLevel = 2
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_RETRUCO" }
      this.gameState.currentPlayer = 1 - this.gameState.currentPlayer
    }
    return this.gameState
  }

  private singValeCuatro(): GameState {
    if (this.gameState.trucoLevel === 2) {
      this.gameState.trucoLevel = 3
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_VALE_CUATRO" }
      this.gameState.currentPlayer = 1 - this.gameState.currentPlayer
    }
    return this.gameState
  }

  private singEnvido(): GameState {
    if (this.gameState.envidoLevel === 0 && this.gameState.currentBaza === 0) {
      this.gameState.envidoLevel = 1
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_ENVIDO" }
      this.gameState.currentPlayer = 1 - this.gameState.currentPlayer
    }
    return this.gameState
  }

  private singRealEnvido(): GameState {
    if (this.gameState.envidoLevel <= 1 && this.gameState.currentBaza === 0) {
      this.gameState.envidoLevel = 2
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_REAL_ENVIDO" }
      this.gameState.currentPlayer = 1 - this.gameState.currentPlayer
    }
    return this.gameState
  }

  private singFaltaEnvido(): GameState {
    if (this.gameState.envidoLevel <= 2 && this.gameState.currentBaza === 0) {
      this.gameState.envidoLevel = 3
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_FALTA_ENVIDO" }
      this.gameState.currentPlayer = 1 - this.gameState.currentPlayer
    }
    return this.gameState
  }

  private acceptBet(): GameState {
    if (this.gameState.pendingAction) {
      const action = this.gameState.pendingAction

      if (action.type.includes("TRUCO") || action.type.includes("RETRUCO") || action.type.includes("VALE")) {
        this.gameState.trucoAccepted = true
        this.gameState.handPoints = this.getTrucoPoints()
      }

      if (action.type.includes("ENVIDO")) {
        this.gameState.envidoAccepted = true
        this.resolveEnvido()
      }

      this.gameState.waitingForResponse = false
      this.gameState.pendingAction = undefined
    }

    return this.gameState
  }

  private rejectBet(): GameState {
    if (this.gameState.pendingAction) {
      const action = this.gameState.pendingAction
      const opponent = 1 - this.gameState.currentPlayer

      if (action.type.includes("TRUCO") || action.type.includes("RETRUCO") || action.type.includes("VALE")) {
        // Give points to opponent for rejected truco
        const points = this.gameState.trucoLevel === 1 ? 1 : this.gameState.trucoLevel === 2 ? 2 : 3
        this.gameState.players[opponent].score += points
      }

      if (action.type.includes("ENVIDO")) {
        // Give envido points to opponent
        const points = this.getEnvidoPoints()
        this.gameState.players[opponent].score += points
      }

      this.gameState.waitingForResponse = false
      this.gameState.pendingAction = undefined

      // Check if game finished
      if (this.gameState.players[opponent].score >= 30) {
        this.gameState.phase = "finished"
      } else {
        this.startNewHand()
      }
    }

    return this.gameState
  }

  private goToDeck(): GameState {
    const opponent = 1 - this.gameState.currentPlayer
    const points = this.gameState.trucoAccepted ? this.getTrucoPoints() : 1

    this.gameState.players[opponent].score += points

    if (this.gameState.players[opponent].score >= 30) {
      this.gameState.phase = "finished"
    } else {
      this.startNewHand()
    }

    return this.gameState
  }

  private resolveEnvido(): void {
    const player1Envido = calculateEnvido(
      this.gameState.players[0].hand.concat(this.gameState.bazas.flatMap((b) => b.cards.filter((_, i) => i % 2 === 0))),
    )

    const player2Envido = calculateEnvido(
      this.gameState.players[1].hand.concat(this.gameState.bazas.flatMap((b) => b.cards.filter((_, i) => i % 2 === 1))),
    )

    const envidoWinner = player1Envido > player2Envido ? 0 : 1
    const points = this.getEnvidoPoints()

    this.gameState.players[envidoWinner].score += points
    this.gameState.envidoPoints = points
  }

  private getTrucoPoints(): number {
    switch (this.gameState.trucoLevel) {
      case 1:
        return 2 // Truco
      case 2:
        return 3 // Retruco
      case 3:
        return 4 // Vale Cuatro
      default:
        return 1
    }
  }

  private getEnvidoPoints(): number {
    switch (this.gameState.envidoLevel) {
      case 1:
        return 2 // Envido
      case 2:
        return 3 // Real Envido
      case 3: {
        // Falta Envido - "al resto" calculation
        const player1Score = this.gameState.players[0].score
        const player2Score = this.gameState.players[1].score
        const maxScore = Math.max(player1Score, player2Score)

        // If both players are in "malas" (0-15), falta is to 15
        // If at least one is in "buenas" (15-30), falta is to 30
        const targetScore = maxScore >= 15 ? 30 : 15
        const pointsToWin = targetScore - maxScore

        return Math.max(1, pointsToWin) // At least 1 point
      }
      default:
        return 0
    }
  }

  private startNewHand(): GameState {
    const deck = createDeck()
    const [playerHand, botHand] = dealCards(deck)

    const newMano = 1 - (this.gameState.mano ?? 0)

    this.gameState.players[0].hand = playerHand
    this.gameState.players[1].hand = botHand
    this.gameState.table = []
    this.gameState.bazas = []
    this.gameState.trucoLevel = 0
    this.gameState.trucoAccepted = false
    this.gameState.envidoLevel = 0
    this.gameState.envidoAccepted = false
    this.gameState.envidoPoints = 0
    this.gameState.handPoints = 1
    this.gameState.currentBaza = 0
    this.gameState.currentPlayer = newMano // Mano starts
    this.gameState.waitingForResponse = false
    this.gameState.pendingAction = undefined
    this.gameState.phase = "playing"
    this.gameState.mano = newMano

    return this.gameState
  }

  public canPlayCard(cardIndex: number): boolean {
    const currentPlayer = this.gameState.players[this.gameState.currentPlayer]
    return (
      !this.gameState.waitingForResponse &&
      cardIndex >= 0 &&
      cardIndex < currentPlayer.hand.length &&
      this.gameState.phase === "playing"
    )
  }
}
