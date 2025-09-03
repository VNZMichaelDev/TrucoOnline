import type { Card, Suit, CardValue } from "./types"

// Card hierarchy for Truco (higher number = stronger card)
const TRUCO_VALUES: Record<string, number> = {
  "espadas-1": 14, // Ancho de espadas
  "bastos-1": 13, // Ancho de bastos
  "espadas-7": 12, // Siete de espadas
  "oro-7": 11, // Siete de oro
  "oro-3": 10, // Tres
  "copas-3": 10,
  "espadas-3": 10,
  "bastos-3": 10,
  "oro-2": 9, // Dos
  "copas-2": 9,
  "espadas-2": 9,
  "bastos-2": 9,
  "oro-1": 8, // Ases falsos
  "copas-1": 8,
  "oro-12": 7, // Figuras
  "copas-12": 7,
  "espadas-12": 7,
  "bastos-12": 7,
  "oro-11": 6,
  "copas-11": 6,
  "espadas-11": 6,
  "bastos-11": 6,
  "oro-10": 5,
  "copas-10": 5,
  "espadas-10": 5,
  "bastos-10": 5,
  "copas-7": 4, // Sietes falsos
  "bastos-7": 4,
  "oro-6": 3,
  "copas-6": 3,
  "espadas-6": 3,
  "bastos-6": 3,
  "oro-5": 2,
  "copas-5": 2,
  "espadas-5": 2,
  "bastos-5": 2,
  "oro-4": 1,
  "copas-4": 1,
  "espadas-4": 1,
  "bastos-4": 1,
}

// Card image URLs from the provided list
const CARD_IMAGES: Record<string, string> = {
  "bastos-1": "https://i.postimg.cc/05K3rdww/bastos-1.jpg",
  "bastos-10": "https://i.postimg.cc/3wwfhghW/bastos-10.jpg",
  "bastos-11": "https://i.postimg.cc/wBbfj7x2/bastos-11.jpg",
  "bastos-12": "https://i.postimg.cc/j5w8wtLb/bastos-12.jpg",
  "bastos-2": "https://i.postimg.cc/KzwHJ4dj/bastos-2.jpg",
  "bastos-3": "https://i.postimg.cc/0jSH3Psf/bastos-3.jpg",
  "bastos-4": "https://i.postimg.cc/HsGNMcwP/bastos-4.jpg",
  "bastos-5": "https://i.postimg.cc/PrmRQXKf/bastos-5.jpg",
  "bastos-6": "https://i.postimg.cc/qv4ZmPZs/bastos-6.jpg",
  "bastos-7": "https://i.postimg.cc/0ynXhVLL/bastos-7.jpg",
  "copas-1": "https://i.postimg.cc/63kMCgvG/copas-1.jpg",
  "copas-10": "https://i.postimg.cc/VN5gpm9C/copas-10.jpg",
  "copas-11": "https://i.postimg.cc/SK5dp3Vt/copas-11.jpg",
  "copas-12": "https://i.postimg.cc/Y9W32Rs2/copas-12.jpg",
  "copas-2": "https://i.postimg.cc/3N2n11Xf/copas-2.jpg",
  "copas-3": "https://i.postimg.cc/8kvKTp2d/copas-3.jpg",
  "copas-4": "https://i.postimg.cc/vHdPTRyJ/copas-4.jpg",
  "copas-5": "https://i.postimg.cc/SN7gzZNJ/copas-5.jpg",
  "copas-6": "https://i.postimg.cc/4xfBvzmw/copas-6.jpg",
  "copas-7": "https://i.postimg.cc/BnmNmXF3/copas-7.jpg",
  "espadas-1": "https://i.postimg.cc/Wzc7dZBG/espadas-1.jpg",
  "espadas-10": "https://i.postimg.cc/fb3755Z7/espadas-10.jpg",
  "espadas-11": "https://i.postimg.cc/zf9CQWXs/espadas-11.jpg",
  "espadas-12": "https://i.postimg.cc/TwgVvwKp/espadas-12.jpg",
  "espadas-2": "https://i.postimg.cc/PJbQYxHB/espadas-2.jpg",
  "espadas-3": "https://i.postimg.cc/66C0DHZY/espadas-3.jpg",
  "espadas-4": "https://i.postimg.cc/vHMzMWLM/espadas-4.jpg",
  "espadas-5": "https://i.postimg.cc/pXZBdpqj/espadas-5.jpg",
  "espadas-6": "https://i.postimg.cc/DwwP4nMM/espadas-6.jpg",
  "espadas-7": "https://i.postimg.cc/9QgtGs3F/espadas-7.jpg",
  "oro-1": "https://i.postimg.cc/J08brLXK/oro-1.jpg",
  "oro-10": "https://i.postimg.cc/0NJm7Qdc/oro-10.jpg",
  "oro-11": "https://i.postimg.cc/qRVKwT10/oro-11.jpg",
  "oro-12": "https://i.postimg.cc/1tGqYjdF/oro-12.jpg",
  "oro-2": "https://i.postimg.cc/j2hyCFQT/oro-2.jpg",
  "oro-3": "https://i.postimg.cc/05GYtzg4/oro-3.jpg",
  "oro-4": "https://i.postimg.cc/7YxgjqwZ/oro-4.jpg",
  "oro-5": "https://i.postimg.cc/5NnwVD2q/oro-5.jpg",
  "oro-6": "https://i.postimg.cc/RZhwVG3r/oro-6.jpg",
  "oro-7": "https://i.postimg.cc/RZYK3ffW/oro-7.jpg",
}

export function createDeck(): Card[] {
  const suits: Suit[] = ["espadas", "bastos", "oro", "copas"]
  const values: CardValue[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]
  const deck: Card[] = []

  for (const suit of suits) {
    for (const value of values) {
      const cardKey = `${suit}-${value}`
      deck.push({
        suit,
        value,
        imageUrl: CARD_IMAGES[cardKey],
        trucoValue: TRUCO_VALUES[cardKey] || 0,
      })
    }
  }

  return deck
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function dealCards(deck: Card[]): [Card[], Card[]] {
  const shuffled = shuffleDeck(deck)
  const player1Hand = shuffled.slice(0, 3)
  const player2Hand = shuffled.slice(3, 6)
  return [player1Hand, player2Hand]
}

// Utility functions for card comparison and envido calculation
export function compareCards(card1: Card, card2: Card): number {
  return card1.trucoValue - card2.trucoValue
}

export function calculateEnvido(cards: Card[]): number {
  const suitGroups: Record<Suit, Card[]> = {
    espadas: [],
    bastos: [],
    oro: [],
    copas: [],
  }

  // Group cards by suit
  cards.forEach((card) => {
    suitGroups[card.suit].push(card)
  })

  let maxEnvido = 0

  // Check each suit for envido points
  Object.values(suitGroups).forEach((suitCards) => {
    if (suitCards.length >= 2) {
      // Sort by envido value (different from truco value)
      const envidoValues = suitCards
        .map((card) => {
          if (card.value >= 10) return 0 // Figures are worth 0 in envido
          return card.value
        })
        .sort((a, b) => b - a)

      const envidoPoints = 20 + envidoValues[0] + envidoValues[1]
      maxEnvido = Math.max(maxEnvido, envidoPoints)
    }
  })

  // If no suit has 2+ cards, return highest card value
  if (maxEnvido === 0) {
    const highestCard = Math.max(...cards.map((card) => (card.value >= 10 ? 0 : card.value)))
    maxEnvido = highestCard
  }

  return maxEnvido
}

export function getCardDisplayName(card: Card): string {
  const suitNames = {
    espadas: "Espadas",
    bastos: "Bastos",
    oro: "Oro",
    copas: "Copas",
  }

  const valueNames: Record<CardValue, string> = {
    1: "As",
    2: "Dos",
    3: "Tres",
    4: "Cuatro",
    5: "Cinco",
    6: "Seis",
    7: "Siete",
    10: "Sota",
    11: "Caballo",
    12: "Rey",
  }

  return `${valueNames[card.value]} de ${suitNames[card.suit]}`
}
