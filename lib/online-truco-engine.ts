import type { GameState, GameAction, BettingState } from "./types"
import { createDeck, dealCards, compareCards, calculateEnvido, shuffleDeck } from "./cards"

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
      currentPlayer: 0, // Always start with player 1 (index 0)
      phase: "playing",
      table: [],
      bazas: [],
      trucoLevel: 0,
      trucoAccepted: false,
      envidoLevel: 0,
      envidoAccepted: false,
      envidoPoints: 0,
      handPoints: 1,
      currentBaza: 0,
      lastWinner: 0,
      waitingForResponse: false,
      pendingAction: null,
      currentPlayerId,
      mano: 0, // Use numeric index for mano
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
      currentPlayer:
        typeof syncedState.currentPlayer === "string"
          ? syncedState.currentPlayer === "player1"
            ? 0
            : 1
          : syncedState.currentPlayer || 0,
      lastWinner:
        typeof syncedState.lastWinner === "string"
          ? syncedState.lastWinner === "player1"
            ? 0
            : 1
          : syncedState.lastWinner || 0,
      mano: typeof syncedState.mano === "string" ? (syncedState.mano === "player1" ? 0 : 1) : syncedState.mano || 0,
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
    // Determinar mi índice de jugador basado en myPlayerId
    const myPlayerIndex = this.myPlayerId === "player1" ? 0 : 1
    const isMyTurn = this.gameState.currentPlayer === myPlayerIndex
    
    console.log(
      "[v0] Turn check - currentPlayer:",
      this.gameState.currentPlayer,
      "myPlayerId:",
      this.myPlayerId,
      "myPlayerIndex:",
      myPlayerIndex,
      "isMyTurn:",
      isMyTurn,
    )
    return isMyTurn
  }

  public getBettingState(): BettingState {
    const isMyTurn = this.isMyTurn()
    const isFirstBaza = this.gameState.currentBaza === 0
    const hasPlayedCard = this.gameState.table.length > 0
    // CORREGIDO: Un jugador puede responder cuando NO es su turno Y hay una apuesta pendiente
    const isWaitingForMyResponse = this.gameState.waitingForResponse && !isMyTurn
    
    // REGLA OFICIAL: Envido debe cantarse antes que Truco
    const canSingTruco = this.gameState.envidoLevel === 0 || this.gameState.envidoAccepted
    
    // REGLA OFICIAL: Envido solo se puede cantar UNA vez por mano y solo en primera baza
    const envidoAlreadySung = this.gameState.envidoLevel > 0 || this.gameState.envidoAccepted
    const anyCardPlayed = this.gameState.bazas.some(baza => baza.cards.length > 0) || hasPlayedCard

    return {
      // TRUCO: puede cantarse en CUALQUIER momento, aunque ya se hayan tirado cartas
      canSingTruco: isMyTurn && !this.gameState.waitingForResponse && this.gameState.trucoLevel === 0 && canSingTruco,
      canSingRetruco: isWaitingForMyResponse && this.gameState.trucoLevel === 1 && this.gameState.pendingAction?.type === "SING_TRUCO",
      canSingValeCuatro: isWaitingForMyResponse && this.gameState.trucoLevel === 2 && this.gameState.pendingAction?.type === "SING_RETRUCO",
      
      // ENVIDO: SOLO en primera baza, ANTES de cualquier carta, y SOLO UNA VEZ por mano
      // Si ya se jugó una carta o pasó la primera baza, los botones de Envido desaparecen
      canSingEnvido: isMyTurn && !this.gameState.waitingForResponse && !envidoAlreadySung && isFirstBaza && !anyCardPlayed,
      canSingRealEnvido: isWaitingForMyResponse && this.gameState.envidoLevel === 1 && this.gameState.pendingAction?.type === "SING_ENVIDO",
      canSingFaltaEnvido: isWaitingForMyResponse && (this.gameState.envidoLevel >= 1) && (this.gameState.pendingAction?.type?.includes("ENVIDO") ?? false),
      
      // Respuestas: solo cuando el oponente está esperando mi respuesta
      canAccept: isWaitingForMyResponse,
      canReject: isWaitingForMyResponse,
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
        this.startNewHand()
        return this.gameState
      case "CONTINUE_AFTER_BAZA":
        return this.continueAfterBaza()
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
      this.gameState.currentPlayer = 1 - (this.gameState.currentPlayer as number)
      console.log("[v0] Switched turn to opponent:", this.gameState.currentPlayer)
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

      // - If first baza is parda, whoever wins second baza wins the hand
      // - If second baza is parda, whoever won first baza wins the hand
      // - If all three bazas are parda, the "mano" (hand starter) wins
      if (this.gameState.currentBaza === 0) {
        // First baza parda - continue playing, winner will be determined by next baza
        winner = this.gameState.lastWinner as number // Temporary, will be overridden
      } else if (this.gameState.currentBaza === 1) {
        // Second baza parda - first baza winner takes the hand
        const firstBazaWinner = this.gameState.bazas[0]?.winner ?? (this.gameState.mano as number)
        winner = firstBazaWinner
      } else {
        // Third baza parda - mano (hand starter) wins
        winner = this.gameState.mano as number
      }
    }

    console.log("[v0] Baza resolved - winner:", winner, "isParda:", isParda, "cards:", this.gameState.table)

    this.gameState.bazas.push({
      winner,
      cards: [...this.gameState.table],
      isParda,
      winnerName: isParda ? "Parda" : this.gameState.players[winner].name,
    })

    if (!isParda || this.gameState.currentBaza > 0) {
      this.gameState.lastWinner = winner
    }

    this.gameState.currentBaza++
    // CORREGIDO: El ganador de la baza inicia la siguiente baza
    this.gameState.currentPlayer = winner
    this.gameState.lastWinner = winner

    // CORREGIDO: Limpiar mesa después de cada baza y continuar
    this.gameState.table = []

    if (this.isHandFinished()) {
      this.finishHand()
    } else {
      // Continuar con la siguiente baza automáticamente
      this.gameState.phase = "playing"
    }
  }

  private singTruco(): GameState {
    // REGLA OFICIAL: Solo se puede cantar Truco si no hay Envido pendiente
    const canSingTruco = this.gameState.envidoLevel === 0 || this.gameState.envidoAccepted
    
    if (this.gameState.trucoLevel === 0 && canSingTruco) {
      this.gameState.trucoLevel = 1
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_TRUCO" }
      
      console.log("[v0] Truco cantado - esperando respuesta del oponente")
      // CRÍTICO: El turno se mantiene igual, el oponente responde sin cambiar currentPlayer
      // Esto permite que el oponente vea los botones de respuesta sin ser "su turno"
    }
    return this.gameState
  }

  private singRetruco(): GameState {
    // Solo se puede cantar retruco como respuesta a truco
    if (this.gameState.trucoLevel === 1 && this.gameState.waitingForResponse && this.gameState.pendingAction?.type === "SING_TRUCO") {
      this.gameState.trucoLevel = 2
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_RETRUCO" }
      
      console.log("[v0] Retruco cantado - esperando respuesta del oponente")
      // CRÍTICO: Cambiar el turno al oponente original para que pueda responder
      this.gameState.currentPlayer = this.gameState.currentPlayer === 0 ? 1 : 0
    }
    return this.gameState
  }

  private singValeCuatro(): GameState {
    // Solo se puede cantar vale cuatro como respuesta a retruco
    if (this.gameState.trucoLevel === 2 && this.gameState.waitingForResponse && this.gameState.pendingAction?.type === "SING_RETRUCO") {
      this.gameState.trucoLevel = 3
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_VALE_CUATRO" }
      
      console.log("[v0] Vale Cuatro cantado - esperando respuesta del oponente")
      // CRÍTICO: Cambiar el turno al oponente original para que pueda responder
      this.gameState.currentPlayer = this.gameState.currentPlayer === 0 ? 1 : 0
    }
    return this.gameState
  }

  private singEnvido(): GameState {
    // REGLA OFICIAL: Envido solo en primera baza y antes de jugar cartas
    const anyCardPlayed = this.gameState.bazas.some(baza => baza.cards.length > 0) || this.gameState.table.length > 0
    
    if (this.gameState.envidoLevel === 0 && this.gameState.currentBaza === 0 && !anyCardPlayed) {
      this.gameState.envidoLevel = 1
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_ENVIDO" }
      
      console.log("[v0] Envido cantado - esperando respuesta del oponente")
      // CRÍTICO: El turno se mantiene igual, el oponente responde sin cambiar currentPlayer
    }
    return this.gameState
  }

  private singRealEnvido(): GameState {
    // Solo se puede cantar real envido como respuesta a envido
    if (this.gameState.envidoLevel === 1 && this.gameState.waitingForResponse && this.gameState.pendingAction?.type === "SING_ENVIDO") {
      this.gameState.envidoLevel = 2
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_REAL_ENVIDO" }
      
      console.log("[v0] Real Envido cantado - esperando respuesta del oponente")
      // CRÍTICO: Cambiar el turno al oponente original para que pueda responder
      this.gameState.currentPlayer = this.gameState.currentPlayer === 0 ? 1 : 0
    }
    return this.gameState
  }

  private singFaltaEnvido(): GameState {
    // Solo se puede cantar falta envido como respuesta a envido o real envido
    if ((this.gameState.envidoLevel === 1 || this.gameState.envidoLevel === 2) && this.gameState.waitingForResponse && this.gameState.pendingAction?.type?.includes("ENVIDO")) {
      this.gameState.envidoLevel = 3
      this.gameState.waitingForResponse = true
      this.gameState.pendingAction = { type: "SING_FALTA_ENVIDO" }
      
      console.log("[v0] Falta Envido cantado - esperando respuesta del oponente")
      // CRÍTICO: Cambiar el turno al oponente original para que pueda responder
      this.gameState.currentPlayer = this.gameState.currentPlayer === 0 ? 1 : 0
    }
    return this.gameState
  }

  private acceptBet(): GameState {
    if (this.gameState.pendingAction) {
      const action = this.gameState.pendingAction

      if (action.type.includes("TRUCO") || action.type.includes("RETRUCO") || action.type.includes("VALE")) {
        this.gameState.trucoAccepted = true
        this.gameState.handPoints = this.getTrucoPoints()
        console.log("[v0] Truco accepted - hand points now:", this.gameState.handPoints)
      }

      if (action.type.includes("ENVIDO")) {
        this.gameState.envidoAccepted = true
        this.resolveEnvido()
        console.log("[v0] Envido accepted and resolved")
      }

      // CRÍTICO: Limpiar estado de espera y continuar el juego
      this.gameState.waitingForResponse = false
      this.gameState.pendingAction = null
      
      console.log("[v0] Bet accepted - game continues normally")
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
      this.gameState.pendingAction = null

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
    
    // REGLA OFICIAL: Primero sumar puntos de Envido si los hay
    if (this.gameState.envidoAccepted && this.gameState.envidoPoints > 0) {
      // Los puntos de Envido ya se sumaron cuando se resolvió
      console.log(`[v0] Envido points already added: ${this.gameState.envidoPoints}`)
    }
    
    // REGLA OFICIAL: Luego sumar puntos del Truco según lo que esté aceptado
    let trucoPoints = 1 // Por defecto 1 punto si no hay Truco aceptado
    if (this.gameState.trucoAccepted) {
      trucoPoints = this.getTrucoPoints()
    }
    
    this.gameState.players[opponentIndex].score += trucoPoints
    console.log(`[v0] Player went to deck - opponent gets ${trucoPoints} points (Truco: ${this.gameState.trucoAccepted ? 'accepted' : 'not accepted'})`)

    if (this.gameState.players[opponentIndex].score >= 30) {
      this.gameState.phase = "finished"
      console.log("[v0] Game finished - opponent reached 30 points")
    } else {
      // CORREGIDO: Iniciar nueva mano con cartas barajadas
      this.startNewHand()
      console.log("[v0] Starting new hand after going to deck - cards shuffled")
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
    
    // NUEVO: Guardar información del Envido para mostrar en UI
    this.gameState.envidoResult = {
      player1Points: player1Envido,
      player2Points: player2Envido,
      winner: envidoWinner,
      pointsAwarded: points,
      showResult: true
    }
    
    console.log(`[v0] Envido resuelto: Player1=${player1Envido}, Player2=${player2Envido}, Ganador=Player${envidoWinner + 1}, Puntos=${points}`)
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
        return 2 // Envido
      case 2:
        return 3 // Real Envido
      case 3: {
        // "al resto" - to 15 if both in "malas", to 30 if at least one in "buenas"
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

    // REGLA OFICIAL: La mano termina cuando alguien gana 2 bazas
    if (bazaWins[0] >= 2 || bazaWins[1] >= 2) {
      return true
    }

    // REGLA OFICIAL: Si se jugaron las 3 bazas, la mano termina
    if (this.gameState.bazas.length >= 3) {
      return true
    }

    // REGLA OFICIAL: Si primera baza parda y segunda decidida, mano termina
    if (this.gameState.bazas.length >= 2 && this.gameState.bazas[0].isParda && !this.gameState.bazas[1].isParda) {
      return true
    }

    // NUEVO: Verificar si algún jugador se quedó sin cartas
    const player1HasCards = this.gameState.players[0].hand.length > 0
    const player2HasCards = this.gameState.players[1].hand.length > 0
    
    // Si algún jugador no tiene cartas y ya se jugó al menos una baza, terminar mano
    if ((!player1HasCards || !player2HasCards) && this.gameState.bazas.length > 0) {
      console.log("[v0] Hand finished - player out of cards")
      return true
    }

    return false
  }

  private startNewHand(): void {
    // CORREGIDO: Resetear completamente el estado para nueva mano
    this.gameState.bazas = []
    this.gameState.currentBaza = 0
    this.gameState.table = []
    this.gameState.trucoLevel = 0
    this.gameState.envidoLevel = 0
    this.gameState.trucoAccepted = false
    this.gameState.envidoAccepted = false
    this.gameState.waitingForResponse = false
    this.gameState.pendingAction = null
    this.gameState.handPoints = 1
    this.gameState.envidoPoints = 0
    this.gameState.phase = "playing"
    
    // NUEVO: Limpiar resultado del Envido anterior
    this.gameState.envidoResult = undefined

    // CORREGIDO: Alternar mano correctamente
    this.gameState.mano = this.gameState.mano === 0 ? 1 : 0
    this.gameState.currentPlayer = this.gameState.mano

    // Barajar y repartir cartas
    const shuffledDeck = shuffleDeck(createDeck())
    this.gameState.players[0].hand = shuffledDeck.slice(0, 3)
    this.gameState.players[1].hand = shuffledDeck.slice(3, 6)

    console.log("[v0] Nueva mano iniciada - Mano:", this.gameState.mano, "Jugador actual:", this.gameState.currentPlayer)
  }

  public getPlayerId(): string {
    return this.myPlayerId
  }

  public getMyPlayerIndex(): number {
    return this.myPlayerId === "player1" ? 0 : 1
  }

  public getCurrentPlayerIndex(): number {
    return this.gameState.currentPlayer
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

  private continueAfterBaza(): GameState {
    // CORREGIDO: Mantener cartas visibles hasta que el usuario continúe
    // Solo limpiar la mesa cuando se continúa explícitamente
    this.gameState.table = []
    
    // Si la mano terminó, no continuar jugando
    if (this.isHandFinished()) {
      this.finishHand()
    } else {
      // Continuar con la siguiente baza
      this.gameState.phase = "playing"
    }
    
    return this.gameState
  }

  private finishHand(): void {
    const bazaWins = [0, 0]

    this.gameState.bazas.forEach((baza) => {
      if (!baza.isParda) {
        bazaWins[baza.winner]++
      }
    })

    let handWinner: number | null = null

    // REGLAS OFICIALES: Determinar ganador de la mano
    if (bazaWins[0] >= 2) {
      handWinner = 0
    } else if (bazaWins[1] >= 2) {
      handWinner = 1
    } else if (bazaWins[0] === 1 && bazaWins[1] === 1) {
      // 1-1 con parda: gana quien ganó la primera baza
      const firstBaza = this.gameState.bazas.find(b => !b.isParda)
      if (firstBaza) {
        handWinner = firstBaza.winner
      } else {
        // Todas pardas: gana la mano
        handWinner = this.gameState.mano as number
      }
    } else {
      // NUEVO: Si un jugador se quedó sin cartas, el otro gana
      const player1HasCards = this.gameState.players[0].hand.length > 0
      const player2HasCards = this.gameState.players[1].hand.length > 0
      
      if (!player1HasCards && player2HasCards) {
        handWinner = 1 // Player 2 gana porque Player 1 no tiene cartas
        console.log("[v0] Player 2 wins - Player 1 out of cards")
      } else if (!player2HasCards && player1HasCards) {
        handWinner = 0 // Player 1 gana porque Player 2 no tiene cartas
        console.log("[v0] Player 1 wins - Player 2 out of cards")
      } else {
        // Todas pardas: gana la mano
        handWinner = this.gameState.mano as number
      }
    }

    if (handWinner !== null) {
      let points = 1 // Punto base por ganar la mano

      // REGLA OFICIAL: Puntos del Truco según nivel (1→2→3→4)
      if (this.gameState.trucoAccepted) {
        points = this.getTrucoPoints()
      }

      // REGLA OFICIAL: Puntos del Envido se suman por separado
      if (this.gameState.envidoAccepted) {
        const envidoPoints = this.getEnvidoPoints()
        this.gameState.players[handWinner].score += envidoPoints
        console.log(`[v0] ${this.gameState.players[handWinner].name} gana ${envidoPoints} puntos de Envido`)
      }

      // Sumar puntos de la mano
      this.gameState.players[handWinner].score += points
      console.log(`[v0] ${this.gameState.players[handWinner].name} gana ${points} puntos de la mano`)

      // REGLA OFICIAL: Verificar si alguien llegó a 30 puntos (ganar el juego)
      if (this.gameState.players[handWinner].score >= 30) {
        this.gameState.phase = "finished"
        this.gameState.winner = this.gameState.players[handWinner].id
        console.log(`[v0] ¡${this.gameState.players[handWinner].name} gana el juego con ${this.gameState.players[handWinner].score} puntos!`)
      } else {
        this.gameState.phase = "hand-result"
      }
    }

    // Reset para la siguiente mano - AHORA sí limpiar la mesa
    this.gameState.currentBaza = 0
    this.gameState.table = []
    this.gameState.bazas = []
    this.gameState.trucoLevel = 0
    this.gameState.envidoLevel = 0
    this.gameState.trucoAccepted = false
    this.gameState.envidoAccepted = false
    this.gameState.waitingForResponse = false
    this.gameState.pendingAction = null
    
    // REGLA OFICIAL: Rotar la mano para la siguiente ronda
    this.gameState.mano = this.gameState.mano === 0 ? 1 : 0
    this.gameState.currentPlayer = this.gameState.mano
  }
}
