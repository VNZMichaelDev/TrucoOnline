import type { GameState, GameAction, BettingState } from "./types"
import { createDeck, dealCards, compareCards, calculateEnvido } from "./cards"

export class OnlineTrucoEngine {
  private gameState: GameState
  private myPlayerId: string

  constructor(player1Name: string, player2Name: string, currentPlayerId: string) {
    this.myPlayerId = currentPlayerId
    this.gameState = this.initializeGame(player1Name, player2Name, currentPlayerId)
  }

  private initializeGame(player1Name: string, player2Name: string, currentPlayerId: string): GameState {
    const deck = createDeck()
    const [player1Hand, player2Hand] = dealCards(deck)

    return {
      players: [
        {
          id: "player1",
          name: player1Name,
          hand: player1Hand,
          score: 0,
          isBot: false,
        },
        {
          id: "player2",
          name: player2Name,
          hand: player2Hand,
          score: 0,
          isBot: false,
        },
      ],
      currentPlayer: "player1", // Use player ID directly instead of index
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
      lastWinner: "player1",
      waitingForResponse: false,
      currentPlayerId,
      mano: "player1", // Use player ID for mano
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
      ...syncedState,
      currentPlayerId,
    }

    console.log("[v0] Synced state - currentPlayer:", engine.gameState.currentPlayer, "myPlayerId:", currentPlayerId)

    return engine
  }

  public getSyncableState(): any {
    return {
      ...this.gameState,
      currentPlayerId: undefined, // Remove device-specific data
    }
  }

  public getGameState(): GameState {
    return { ...this.gameState }
  }

  public isMyTurn(): boolean {
    const isMyTurn = this.gameState.currentPlayer === this.myPlayerId
    console.log(
      "[v0] Turn check - currentPlayer:",
      this.gameState.currentPlayer,
      "myPlayerId:",
      this.myPlayerId,
      "isMyTurn:",
      isMyTurn,
    )
    return isMyTurn
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
      console.log("[v0] Not my turn, ignoring action:", action.type, "currentPlayer:", this.gameState.currentPlayer)
      return this.gameState
    }

    if (isResponse && isMyTurn) {
      console.log("[v0] Cannot respond to own bet")
      return this.gameState
    }

    console.log("[v0] Processing action:", action.type, "isMyTurn:", isMyTurn)

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
    if (!this.isMyTurn() || this.gameState.waitingForResponse) {
      console.log("[v0] Cannot play card - not my turn or waiting for response")
      return this.gameState
    }

    const myPlayerIndex = this.myPlayerId === "player1" ? 0 : 1
    const currentPlayer = this.gameState.players[myPlayerIndex]

    if (cardIndex < 0 || cardIndex >= currentPlayer.hand.length) {
      console.log("[v0] Invalid card index:", cardIndex)
      return this.gameState
    }

    const playedCard = currentPlayer.hand[cardIndex]
    console.log("[v0] Playing card:", playedCard)

    // Remove card from hand
    currentPlayer.hand.splice(cardIndex, 1)

    // Add card to table
    this.gameState.table.push(playedCard)

    // If both players have played, resolve baza
    if (this.gameState.table.length === 2) {
      this.resolveBaza()
    } else {
      this.gameState.currentPlayer = this.myPlayerId === "player1" ? "player2" : "player1"
      console.log("[v0] Switched turn to opponent:", this.gameState.currentPlayer)
    }

    return this.gameState
  }

  private resolveBaza(): void {
    const [card1, card2] = this.gameState.table
    const comparison = compareCards(card2, card1)

    let winner: string
    let isDraw = false

    if (comparison > 0) {
      winner = this.myPlayerId === "player1" ? "player2" : "player1" // Second card wins (opponent)
    } else if (comparison < 0) {
      winner = this.myPlayerId // First card wins (me)
    } else {
      isDraw = true
      winner = this.gameState.lastWinner
    }

    console.log("[v0] Baza resolved - winner:", winner, "cards:", this.gameState.table)

    this.gameState.bazas.push({
      winner: winner === "player1" ? 0 : 1, // Convert back to index for display
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

  private singTruco(): GameState {
    if (this.gameState.trucoLevel === 0) {
      this.gameState.trucoLevel = 1
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_TRUCO" }
      this.gameState.currentPlayer = this.myPlayerId === "player1" ? "player2" : "player1"
    }
    return this.gameState
  }

  private singRetruco(): GameState {
    if (this.gameState.trucoLevel === 1) {
      this.gameState.trucoLevel = 2
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_RETRUCO" }
      this.gameState.currentPlayer = this.myPlayerId === "player1" ? "player2" : "player1"
    }
    return this.gameState
  }

  private singValeCuatro(): GameState {
    if (this.gameState.trucoLevel === 2) {
      this.gameState.trucoLevel = 3
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_VALE_CUATRO" }
      this.gameState.currentPlayer = this.myPlayerId === "player1" ? "player2" : "player1"
    }
    return this.gameState
  }

  private singEnvido(): GameState {
    if (this.gameState.envidoLevel === 0 && this.gameState.currentBaza === 0) {
      this.gameState.envidoLevel = 1
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_ENVIDO" }
      this.gameState.currentPlayer = this.myPlayerId === "player1" ? "player2" : "player1"
    }
    return this.gameState
  }

  private singRealEnvido(): GameState {
    if (this.gameState.envidoLevel <= 1 && this.gameState.currentBaza === 0) {
      this.gameState.envidoLevel = 2
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_REAL_ENVIDO" }
      this.gameState.currentPlayer = this.myPlayerId === "player1" ? "player2" : "player1"
    }
    return this.gameState
  }

  private singFaltaEnvido(): GameState {
    if (this.gameState.envidoLevel <= 2 && this.gameState.currentBaza === 0) {
      this.gameState.envidoLevel = 3
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_FALTA_ENVIDO" }
      this.gameState.currentPlayer = this.myPlayerId === "player1" ? "player2" : "player1"
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
      const opponentId = this.myPlayerId === "player1" ? "player2" : "player1"
      const opponentIndex = opponentId === "player1" ? 0 : 1

      if (action.type.includes("TRUCO") || action.type.includes("RETRUCO") || action.type.includes("VALE")) {
        const points = this.gameState.trucoLevel === 1 ? 1 : this.gameState.trucoLevel === 2 ? 2 : 3
        this.gameState.players[opponentIndex].score += points
      }

      if (action.type.includes("ENVIDO")) {
        const points = this.getEnvidoPoints()
        this.gameState.players[opponentIndex].score += points
      }

      this.gameState.waitingForResponse = false
      this.gameState.pendingAction = undefined

      if (this.gameState.players[opponentIndex].score >= 30) {
        this.gameState.phase = "finished"
      } else {
        this.startNewHand()
      }
    }

    return this.gameState
  }

  private goToDeck(): GameState {
    const opponentId = this.myPlayerId === "player1" ? "player2" : "player1"
    const opponentIndex = opponentId === "player1" ? 0 : 1
    const points = this.gameState.trucoAccepted ? this.getTrucoPoints() : 1

    this.gameState.players[opponentIndex].score += points

    if (this.gameState.players[opponentIndex].score >= 30) {
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

  private isHandFinished(): boolean {
    // Hand is finished when someone wins 2 bazas or all 3 bazas are played
    const myWins = this.gameState.bazas.filter((b) => b.winner === 0).length
    const opponentWins = this.gameState.bazas.filter((b) => b.winner === 1).length

    return myWins >= 2 || opponentWins >= 2 || this.gameState.bazas.length >= 3
  }

  private startNewHand(): GameState {
    const deck = createDeck()
    const [player1Hand, player2Hand] = dealCards(deck)

    const newMano = this.gameState.mano === "player1" ? "player2" : "player1"
    const startingPlayer = newMano === "player1" ? "player2" : "player1" // Non-dealer starts

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
    this.gameState.currentPlayer = startingPlayer
    this.gameState.lastWinner = startingPlayer
    this.gameState.waitingForResponse = false
    this.gameState.pendingAction = undefined
    this.gameState.phase = "playing"
    this.gameState.mano = newMano

    console.log("[v0] New hand started - mano:", newMano, "starting player:", startingPlayer)

    return this.gameState
  }

  public canPlayCard(cardIndex: number): boolean {
    const isMyTurn = this.isMyTurn()
    const myPlayerIndex = this.myPlayerId === "player1" ? 0 : 1
    const myPlayer = this.gameState.players[myPlayerIndex]

    if (!myPlayer || !Array.isArray(myPlayer.hand)) {
      console.log("[v0] Invalid player or hand for card play")
      return false
    }

    const canPlay =
      isMyTurn &&
      !this.gameState.waitingForResponse &&
      cardIndex >= 0 &&
      cardIndex < myPlayer.hand.length &&
      this.gameState.phase === "playing"

    console.log("[v0] Can play card:", canPlay, "isMyTurn:", isMyTurn, "waiting:", this.gameState.waitingForResponse)
    return canPlay
  }

  public getPlayerId(): string {
    return this.myPlayerId
  }

  public getCurrentPlayerIndex(): number {
    return this.myPlayerId === "player1" ? 0 : 1 // Always return 0 for display purposes (my player)
  }

  public getCurrentPlayer(): any {
    const myPlayerIndex = this.myPlayerId === "player1" ? 0 : 1
    return (
      this.gameState.players[myPlayerIndex] || {
        id: this.myPlayerId,
        name: "Unknown Player",
        hand: [],
        score: 0,
        isBot: false,
      }
    )
  }

  public getOpponent(): any {
    const opponentIndex = this.myPlayerId === "player1" ? 1 : 0
    return (
      this.gameState.players[opponentIndex] || {
        id: "opponent",
        name: "Unknown Player",
        hand: [],
        score: 0,
        isBot: false,
      }
    )
  }

  private finishHand(): void {
    const myWins = this.gameState.bazas.filter((b) => {
      const winnerPlayerId = b.winner === 0 ? "player1" : "player2"
      return winnerPlayerId === this.myPlayerId
    }).length

    const opponentWins = this.gameState.bazas.filter((b) => {
      const winnerPlayerId = b.winner === 0 ? "player1" : "player2"
      return winnerPlayerId !== this.myPlayerId
    }).length

    let handWinner: string
    if (myWins > opponentWins) {
      handWinner = this.myPlayerId
    } else {
      handWinner = this.myPlayerId === "player1" ? "player2" : "player1"
    }

    const winnerIndex = handWinner === "player1" ? 0 : 1
    const points = this.gameState.trucoAccepted ? this.getTrucoPoints() : 1

    this.gameState.players[winnerIndex].score += points

    if (this.gameState.players[winnerIndex].score >= 30) {
      this.gameState.phase = "finished"
    } else {
      this.startNewHand()
    }
  }
}
