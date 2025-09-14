// Card types for Truco game
export type Suit = "espadas" | "bastos" | "oro" | "copas"
export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12

export interface Card {
  suit: Suit
  value: CardValue
  imageUrl: string
  trucoValue: number // For card hierarchy in Truco
}

export interface Player {
  id: string
  name: string
  hand: Card[]
  score: number
  isBot: boolean
}

export type EnvidoPaso = "envido" | "real" | "falta"

export interface PendingCanto {
  familia: "truco" | "envido" | "flor"
  nivel: number
  cantante: number
  responder: number
  envidoChain?: EnvidoPaso[]
}

export interface GameState {
  players: Player[]
  currentPlayer: number
  currentBaza: number
  bazas: { winner: number; cards: Card[]; isParda?: boolean; winnerName?: string }[]
  table: Card[]
  trucoLevel: number
  envidoLevel: number
  trucoAccepted: boolean
  envidoAccepted: boolean
  cantoPendiente: PendingCanto | null
  envidoCerrado: boolean
  puedeSubirTruco: number | null
  handPoints: number
  envidoPoints: number
  mano: number
  lastWinner: number | null
  phase: "waiting" | "playing" | "hand_finished" | "game_finished"
  winner?: number
  gameFinished?: boolean
  handWinner?: number
  envidoResult?: {
    player1Points: number
    player2Points: number
    winner: number
    pointsAwarded: number
    showResult: boolean
  }
  // Campos obsoletos que vamos a eliminar gradualmente
  waitingForResponse?: boolean
  pendingAction?: GameAction | null
  currentPlayerId?: string // Device-specific field, not synced
}

export type GameAction =
  | { type: "PLAY_CARD"; cardIndex: number }
  | { type: "SING_TRUCO" }
  | { type: "SING_RETRUCO" }
  | { type: "SING_VALE_CUATRO" }
  | { type: "SING_ENVIDO" }
  | { type: "SING_REAL_ENVIDO" }
  | { type: "SING_FALTA_ENVIDO" }
  | { type: "ACCEPT" }
  | { type: "REJECT" }
  | { type: "GO_TO_DECK" }
  | { type: "START_NEW_HAND" }
  | { type: "CONTINUE_AFTER_BAZA" }

export interface BettingState {
  canSingTruco: boolean
  canSingRetruco: boolean
  canSingValeCuatro: boolean
  canSingEnvido: boolean
  canSingRealEnvido: boolean
  canSingFaltaEnvido: boolean
  canAccept: boolean
  canReject: boolean
  canGoToDeck: boolean
}

export interface BazaResult {
  winner: number
  isDraw: boolean
  cards: Card[]
}

export interface HandResult {
  winner: number
  points: number
  reason: "truco" | "envido" | "deck" | "bazas"
}
