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

export interface GameState {
  players: [Player, Player]
  currentPlayer: number | string
  phase: "dealing" | "envido" | "truco" | "playing" | "baza-result" | "hand-result" | "finished"
  table: Card[]
  bazas: { winner: number; cards: Card[]; isParda?: boolean; winnerName?: string }[] // Who won each baza and what cards
  trucoLevel: 0 | 1 | 2 | 3 // 0=none, 1=truco, 2=retruco, 3=vale4
  trucoAccepted: boolean
  envidoLevel: 0 | 1 | 2 | 3 // 0=none, 1=envido, 2=real envido, 3=falta envido
  envidoAccepted: boolean
  envidoPoints: number
  gamePoints: number
  handPoints: number // Points for current hand
  currentBaza: number
  lastWinner: number | string // Who won the last baza
  waitingForResponse: boolean
  pendingAction?: GameAction
  currentPlayerId?: string
  mano: string | number // Player who starts the hand (rotates each hand)
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
