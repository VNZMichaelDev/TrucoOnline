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

    const isPlayer1Mano = true // Player 1 is always "mano" in first hand
    const startingPlayer = 1 // Player 2 (non-dealer) starts according to Truco rules

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
      currentPlayer: startingPlayer, // Start with player 2 (non-dealer)
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
      lastWinner: startingPlayer,
      waitingForResponse: false,
      currentPlayerId,
      mano: 0, // Player 1 is "mano" (dealer)
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

    const myGlobalIndex = engine.findPlayerGlobalIndex(syncedState, currentPlayerId)
    const opponentGlobalIndex = 1 - myGlobalIndex

    console.log("[v0] === SYNC DEBUG ===")
    console.log("[v0] currentPlayerId:", currentPlayerId)
    console.log("[v0] myGlobalIndex:", myGlobalIndex)
    console.log("[v0] globalCurrentPlayer:", syncedState.currentPlayer)
    console.log(
      "[v0] syncedState.players:",
      syncedState.players.map((p) => ({ id: p.id, name: p.name })),
    )

    const localCurrentPlayer = syncedState.currentPlayer === myGlobalIndex ? 0 : 1
    console.log("[v0] Mapped to localCurrentPlayer:", localCurrentPlayer)
    console.log("[v0] This means isMyTurn will be:", localCurrentPlayer === 0)

    engine.gameState = {
      ...syncedState,
      currentPlayerId,
      players: [
        // My player is always at local index 0
        {
          ...syncedState.players[myGlobalIndex],
          hand: Array.isArray(syncedState.players[myGlobalIndex]?.hand) ? syncedState.players[myGlobalIndex].hand : [],
        },
        // Opponent is always at local index 1
        {
          ...syncedState.players[opponentGlobalIndex],
          hand: Array.isArray(syncedState.players[opponentGlobalIndex]?.hand)
            ? syncedState.players[opponentGlobalIndex].hand
            : [],
        },
      ],
      currentPlayer: localCurrentPlayer,
    }

    console.log("[v0] Final local state - currentPlayer:", engine.gameState.currentPlayer)
    console.log("[v0] === END SYNC DEBUG ===")

    return engine
  }

  private findPlayerGlobalIndex(gameState: any, playerId: string): number {
    if (!gameState.players) return 0

    console.log("[v0] Finding global index for playerId:", playerId)

    // Try to find by ID first
    const indexById = gameState.players.findIndex((p: any) => p.id === playerId)
    if (indexById !== -1) {
      console.log("[v0] Found by ID at index:", indexById)
      return indexById
    }

    // Try to find by name match
    let indexByName = gameState.players.findIndex((p: any) => p.name === playerId)
    if (indexByName !== -1) {
      console.log("[v0] Found by name at index:", indexByName)
      return indexByName
    }

    // Try partial name match (in case of truncation)
    indexByName = gameState.players.findIndex(
      (p: any) => p.name && playerId && (p.name.includes(playerId) || playerId.includes(p.name)),
    )
    if (indexByName !== -1) {
      console.log("[v0] Found by partial name match at index:", indexByName)
      return indexByName
    }

    // Fallback: check if playerId looks like player1 or player2
    if (playerId.includes("player1") || playerId.includes("Player 1")) {
      console.log("[v0] Fallback to player1 (index 0)")
      return 0
    }
    if (playerId.includes("player2") || playerId.includes("Player 2")) {
      console.log("[v0] Fallback to player2 (index 1)")
      return 1
    }

    console.log("[v0] No match found, defaulting to index 0")
    return 0
  }

  public getSyncableState(): any {
    const myGlobalIndex = this.findPlayerGlobalIndex(this.gameState, this.myPlayerId)
    const opponentGlobalIndex = 1 - myGlobalIndex

    const globalPlayers = [null, null]
    globalPlayers[myGlobalIndex] = {
      ...this.gameState.players[0], // My player (local index 0)
      id: this.myPlayerId,
    }
    globalPlayers[opponentGlobalIndex] = {
      ...this.gameState.players[1], // Opponent (local index 1)
      id: myGlobalIndex === 0 ? "player2" : "player1",
      hand: [], // Hide opponent's hand in sync
    }

    const globalCurrentPlayer = this.gameState.currentPlayer === 0 ? myGlobalIndex : opponentGlobalIndex

    console.log("[v0] === SYNC OUT DEBUG ===")
    console.log("[v0] localCurrentPlayer:", this.gameState.currentPlayer)
    console.log("[v0] myGlobalIndex:", myGlobalIndex)
    console.log("[v0] Converting to globalCurrentPlayer:", globalCurrentPlayer)
    console.log("[v0] === END SYNC OUT DEBUG ===")

    return {
      ...this.gameState,
      players: globalPlayers,
      currentPlayer: globalCurrentPlayer,
      currentPlayerId: undefined, // Remove device-specific data
    }
  }

  public getGameState(): GameState {
    return { ...this.gameState }
  }

  public isMyTurn(): boolean {
    const isMyTurn = this.gameState.currentPlayer === 0
    console.log("[v0] Checking if my turn:", isMyTurn, "currentPlayer:", this.gameState.currentPlayer)
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

    const currentPlayer = this.gameState.players[0] // My player is always at index 0

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
      // Switch to other player
      this.gameState.currentPlayer = 1 - this.gameState.currentPlayer
      console.log("[v0] Switched turn to player:", this.gameState.currentPlayer)
    }

    return this.gameState
  }

  private resolveBaza(): void {
    const [card1, card2] = this.gameState.table
    const comparison = compareCards(card2, card1)

    let winner: number
    let isDraw = false

    if (comparison > 0) {
      winner = 1 // Second card wins (opponent)
    } else if (comparison < 0) {
      winner = 0 // First card wins (me)
    } else {
      isDraw = true
      winner = this.gameState.lastWinner
    }

    console.log("[v0] Baza resolved - winner:", winner, "cards:", this.gameState.table)

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

  private isHandFinished(): boolean {
    // Hand is finished when someone wins 2 bazas or all 3 bazas are played
    const myWins = this.gameState.bazas.filter((b) => b.winner === 0).length
    const opponentWins = this.gameState.bazas.filter((b) => b.winner === 1).length

    return myWins >= 2 || opponentWins >= 2 || this.gameState.bazas.length >= 3
  }

  private finishHand(): void {
    const myWins = this.gameState.bazas.filter((b) => b.winner === 0).length
    const opponentWins = this.gameState.bazas.filter((b) => b.winner === 1).length

    let handWinner: number
    if (myWins > opponentWins) {
      handWinner = 0
    } else {
      handWinner = 1
    }

    // Award points
    const points = this.gameState.trucoAccepted ? this.getTrucoPoints() : 1
    this.gameState.players[handWinner].score += points

    console.log("[v0] Hand finished - winner:", handWinner, "points:", points)

    // Check if game is finished
    if (this.gameState.players[handWinner].score >= 30) {
      this.gameState.phase = "finished"
    } else {
      this.startNewHand()
    }
  }

  private startNewHand(): GameState {
    const deck = createDeck()
    const [player1Hand, player2Hand] = dealCards(deck)

    const newMano = 1 - (this.gameState.mano || 0)
    const startingPlayer = 1 - newMano // Non-dealer starts according to Truco rules

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
    this.gameState.currentPlayer = startingPlayer // Non-dealer starts
    this.gameState.lastWinner = startingPlayer
    this.gameState.waitingForResponse = false
    this.gameState.pendingAction = undefined
    this.gameState.phase = "playing"
    this.gameState.mano = newMano // Update who is "mano"

    console.log("[v0] New hand started - mano:", newMano, "starting player:", startingPlayer)

    return this.gameState
  }

  public canPlayCard(cardIndex: number): boolean {
    const isMyTurn = this.isMyTurn()
    const myPlayer = this.gameState.players[0]

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
    return 0 // Always return 0 for display purposes (my player)
  }

  public getCurrentPlayer(): any {
    return (
      this.gameState.players[0] || {
        id: this.myPlayerId,
        name: "Unknown Player",
        hand: [],
        score: 0,
        isBot: false,
      }
    )
  }

  public getOpponent(): any {
    return (
      this.gameState.players[1] || {
        id: "opponent",
        name: "Unknown Player",
        hand: [],
        score: 0,
        isBot: false,
      }
    )
  }
}
