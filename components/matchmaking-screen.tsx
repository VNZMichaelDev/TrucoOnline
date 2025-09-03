"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Users, Wifi } from "lucide-react"
import { RealtimeGameManager } from "@/lib/realtime-game"

interface MatchmakingScreenProps {
  playerName: string
  onMatchFound: (opponentName: string, gameId: string) => void
  onCancel: () => void
}

export default function MatchmakingScreen({ playerName, onMatchFound, onCancel }: MatchmakingScreenProps) {
  const [searchTime, setSearchTime] = useState(0)
  const [dots, setDots] = useState("")
  const [playersOnline, setPlayersOnline] = useState(0)
  const [gameManager] = useState(() => new RealtimeGameManager())
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    const startMatchmaking = async () => {
      setIsSearching(true)
      try {
        const result = await gameManager.findMatch(playerName)
        if (result) {
          onMatchFound(result.opponentName, result.gameId)
        }
      } catch (error) {
        console.error("Error finding match:", error)
        // Fallback to retry
        setTimeout(startMatchmaking, 2000)
      }
    }

    startMatchmaking()

    // Get real player count
    gameManager.getOnlinePlayersCount().then((count) => {
      setPlayersOnline(count)
    })

    return () => {
      if (isSearching) {
        gameManager.cancelMatchmaking()
      }
    }
  }, [playerName, onMatchFound, gameManager, isSearching])

  useEffect(() => {
    const timer = setInterval(() => {
      setSearchTime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const dotsTimer = setInterval(() => {
      setDots((prev) => {
        if (prev === "...") return ""
        return prev + "."
      })
    }, 500)

    return () => clearInterval(dotsTimer)
  }, [])

  useEffect(() => {
    const playersTimer = setInterval(() => {
      gameManager.getOnlinePlayersCount().then((count) => {
        setPlayersOnline(count)
      })
    }, 5000)

    return () => clearInterval(playersTimer)
  }, [gameManager])

  const handleCancel = () => {
    gameManager.cancelMatchmaking()
    onCancel()
  }

  return (
    <div
      className="h-screen overflow-hidden flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage:
          "url(https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fondojuego.jpg-aASnDGPRF1q77ESLQSAJr6YUx7O1sJ.jpeg)",
      }}
    >
      <Card className="w-full max-w-md mx-4 bg-black/90 border-2 border-amber-500/50 shadow-2xl rounded-xl">
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="text-amber-200 hover:bg-amber-600/20 h-10 w-10 rounded-full"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <h2 className="text-xl font-bold text-amber-200">Buscando Partida</h2>
            <div className="w-10" /> {/* Spacer */}
          </div>

          <div className="mb-8">
            <div className="relative mb-6">
              <div className="w-24 h-24 mx-auto bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center animate-pulse">
                <Users className="h-12 w-12 text-white" />
              </div>
              <div className="absolute inset-0 w-24 h-24 mx-auto border-4 border-amber-500 rounded-full animate-spin border-t-transparent"></div>
            </div>

            <h3 className="text-2xl font-bold text-white mb-2">Emparejando{dots}</h3>
            <p className="text-amber-200 text-lg mb-4">Buscando oponente para {playerName}</p>

            <div className="bg-black/50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Wifi className="h-5 w-5 text-green-400" />
                <span className="text-green-400 font-semibold">Conectado</span>
              </div>
              <p className="text-amber-100 text-sm">
                Jugadores en línea: <span className="text-amber-300 font-bold">{playersOnline}</span>
              </p>
              <p className="text-gray-400 text-xs mt-1">Tiempo de búsqueda: {searchTime}s</p>
            </div>

            <div className="space-y-2 text-sm text-gray-300">
              <p>• Buscando jugadores de tu nivel</p>
              <p>• Conexión estable requerida</p>
              <p>• Partida a 30 puntos</p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleCancel}
            className="w-full border-2 border-red-500 text-red-400 hover:bg-red-500/20 h-12 text-base font-bold rounded-xl bg-transparent"
          >
            Cancelar Búsqueda
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
