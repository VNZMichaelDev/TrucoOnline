import type { GameState, GameAction, BettingState } from "./types"
import { createDeck, dealCards, compareCards, calculateEnvido } from "./cards"

export class OnlineTrucoEngine {
  private gameState: GameState

  constructor(player1Name: string, player2Name: string, currentPlayerId: string) {
    this.gameState = this.initializeGame(player1Name, player2Name, currentPlayerId)
  }

  private initializeGame(player1Name: string, player2Name: string, currentPlayerId: string): GameState {
    const deck = createDeck()
    const [player1Hand, player2Hand] = dealCards(deck)

    return {
      players: [
        {
          id: currentPlayerId, // This device's player
          name: player1Name,
          hand: player1Hand,
          score: 0,
          isBot: false,
        },
        {
          id: "opponent", // The other player
          name: player2Name,
          hand: player2Hand,
          score: 0,
          isBot: false,
        },
      ],
      currentPlayer: 0, // Index of whose turn it is (0 or 1)
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
      currentPlayerId, // ID of the player using this device
    }
  }

  public static fromSyncedState(syncedState: any, currentPlayerId: string): OnlineTrucoEngine {
    if (!syncedState || !syncedState.players || syncedState.players.length !== 2) {
      console.log("[v0] Invalid synced state, creating new game")
      return new OnlineTrucoEngine("Player 1", "Player 2", currentPlayerId)
    }

    const engine = new OnlineTrucoEngine(
      syncedState.players[0]?.name || "Player 1",
      syncedState.players[1]?.name || "Player 2",
      currentPlayerId,
    )

    engine.gameState = {
      ...engine.gameState,
      ...syncedState,
      currentPlayerId,
      // Ensure the first player is always the current device's player
      players: [
        {
          ...syncedState.players[0],
          id: currentPlayerId, // This device's player
          hand: Array.isArray(syncedState.players[0].hand) ? syncedState.players[0].hand : [],
        },
        {
          ...syncedState.players[1],
          id: "opponent", // The other player
          hand: Array.isArray(syncedState.players[1].hand) ? syncedState.players[1].hand : [],
        },
      ],
    }

    return engine
  }

  public getSyncableState(): any {
    const currentPlayerIndex = this.getCurrentPlayerIndex()
    const opponentIndex = 1 - currentPlayerIndex

    if (!this.gameState.players || this.gameState.players.length !== 2) {
      console.log("[v0] Invalid game state for sync")
      return this.gameState
    }

    return {
      ...this.gameState,
      players: this.gameState.players.map((player, index) => {
        // Ensure player object is valid
        if (!player) {
          console.log("[v0] Invalid player at index", index)
          return {
            id: index === 0 ? this.gameState.currentPlayerId : "opponent",
            name: index === 0 ? "Player 1" : "Player 2",
            hand: [],
            score: 0,
            isBot: false,
          }
        }

        return {
          ...player,
          // Hide opponent's hand for security, but keep structure
          hand: index === opponentIndex ? [] : Array.isArray(player.hand) ? player.hand : [],
        }
      }),
    }
  }

  public getGameState(): GameState {
    return { ...this.gameState }
  }

  private getCurrentPlayerIndex(): number {
    return 0 // This device's player is always at index 0
  }

  public isMyTurn(): boolean {
    return this.gameState.currentPlayer === 0 // 0 means it's this device's turn
  }

  public getBettingState(): BettingState {
    const isMyTurn = this.isMyTurn()
    const isFirstBaza = this.gameState.currentBaza === 0
    const hasPlayedCard = this.gameState.table.length > 0

    return {
      canSingTruco: isMyTurn && !this.gameState.waitingForResponse && this.gameState.trucoLevel < 3 && !hasPlayedCard,
      canSingEnvido:
        isMyTurn &&
        !this.gameState.waitingForResponse &&
        this.gameState.envidoLevel === 0 &&
        isFirstBaza &&
        !hasPlayedCard,
      canAccept: !isMyTurn && this.gameState.waitingForResponse,
      canReject: !isMyTurn && this.gameState.waitingForResponse,
      canGoToDeck: isMyTurn && !this.gameState.waitingForResponse,
    }
  }

  public processAction(action: GameAction): GameState {
    const isMyTurn = this.isMyTurn()
    const isResponse = action.type === "ACCEPT" || action.type === "REJECT"

    if (!isMyTurn && !isResponse) {
      return this.gameState
    }

    if (isResponse && isMyTurn) {
      return this.gameState // Can't respond to own bet
    }

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
    const currentPlayerIndex = this.gameState.currentPlayer
    const currentPlayer = this.gameState.players[currentPlayerIndex]

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
    let isDraw = false

    if (comparison > 0) {
      winner = 1
    } else if (comparison < 0) {
      winner = 0
    } else {
      isDraw = true
      winner = this.gameState.lastWinner
    }

    this.gameState.bazas.push({
      winner,
      cards: [...this.gameState.table],
    })

    this.gameState.table = []
    this.gameState.lastWinner = winner
    this.gameState.currentBaza++
    this.gameState.currentPlayer = winner

    if (this.isHandFinished()) {
      this.finishHand()
    }
  }

  private isHandFinished(): boolean {
    const bazaWins = [0, 0]
    this.gameState.bazas.forEach((baza) => {
      bazaWins[baza.winner]++
    })
    return bazaWins[0] >= 2 || bazaWins[1] >= 2 || this.gameState.bazas.length >= 3
  }

  private finishHand(): void {
    const bazaWins = [0, 0]
    this.gameState.bazas.forEach((baza) => {
      bazaWins[baza.winner]++
    })

    const handWinner = bazaWins[0] > bazaWins[1] ? 0 : 1
    let points = this.gameState.handPoints

    if (this.gameState.trucoAccepted) {
      points = this.getTrucoPoints()
    }

    if (this.gameState.envidoAccepted && this.gameState.envidoPoints > 0) {
      points += this.getEnvidoPoints()
    }

    this.gameState.players[handWinner].score += points

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
        const points = this.gameState.trucoLevel === 1 ? 1 : this.gameState.trucoLevel === 2 ? 2 : 3
        this.gameState.players[opponent].score += points
      }

      if (action.type.includes("ENVIDO")) {
        const points = this.getEnvidoPoints()
        this.gameState.players[opponent].score += points
      }

      this.gameState.waitingForResponse = false
      this.gameState.pendingAction = undefined

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
        return 2
      case 2:
        return 3
      case 3:
        return 4
      default:
        return 1
    }
  }

  private getEnvidoPoints(): number {
    switch (this.gameState.envidoLevel) {
      case 1:
        return 2
      case 2:
        return 3
      case 3:
        return Math.max(15, 30 - Math.min(this.gameState.players[0].score, this.gameState.players[1].score))
      default:
        return 0
    }
  }

  private startNewHand(): GameState {
    const deck = createDeck()
    const [player1Hand, player2Hand] = dealCards(deck)

    this.gameState.players[0].hand = player1Hand
    this.gameState.players[1].hand = player2Hand
    this.gameState.table = []
    this.gameState.bazas = []
    this.gameState.trucoLevel = 0
    this.gameState.trucoAccepted = false
    this.gameState.envidoLevel = 0
    this.gameState.envidoAccepted = false
    this.gameState.envidoPoints = 0
    this.gameState.handPoints = 1
    this.gameState.currentBaza = 0
    this.gameState.currentPlayer = 0
    this.gameState.waitingForResponse = false
    this.gameState.pendingAction = undefined
    this.gameState.phase = "playing"

    return this.gameState
  }

  public canPlayCard(cardIndex: number): boolean {
    const isMyTurn = this.isMyTurn()
    const myIndex = this.getCurrentPlayerIndex()
    const myPlayer = this.gameState.players[myIndex]

    if (!myPlayer || !Array.isArray(myPlayer.hand)) {
      console.log("[v0] Invalid player or hand for card play")
      return false
    }

    return (
      isMyTurn &&
      !this.gameState.waitingForResponse &&
      cardIndex >= 0 &&
      cardIndex < myPlayer.hand.length &&
      this.gameState.phase === "playing"
    )
  }

  public getPlayerId(): string {
    return this.gameState.currentPlayerId
  }

  public getCurrentPlayer(): any {
    if (!this.gameState.players || !this.gameState.players[0]) {
      console.log("[v0] Current player not found")
      return {
        id: this.gameState.currentPlayerId,
        name: "Unknown Player",
        hand: [],
        score: 0,
        isBot: false,
      }
    }
    return this.gameState.players[0]
  }

  public getOpponent(): any {
    if (!this.gameState.players || !this.gameState.players[1]) {
      console.log("[v0] Opponent not found")
      return {
        id: "opponent",
        name: "Unknown Player",
        hand: [],
        score: 0,
        isBot: false,
      }
    }
    return this.gameState.players[1]
  }
}
