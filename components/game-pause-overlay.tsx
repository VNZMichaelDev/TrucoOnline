"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Pause, Play, Home, RefreshCw } from "lucide-react"

interface GamePauseOverlayProps {
  isPaused: boolean
  reason: "manual" | "connection" | "opponent_left"
  onResume: () => void
  onBackToMenu: () => void
  onReconnect?: () => void
  opponentName?: string
}

export default function GamePauseOverlay({
  isPaused,
  reason,
  onResume,
  onBackToMenu,
  onReconnect,
  opponentName,
}: GamePauseOverlayProps) {
  if (!isPaused) return null

  const getTitle = () => {
    switch (reason) {
      case "manual":
        return "Juego Pausado"
      case "connection":
        return "Problemas de Conexión"
      case "opponent_left":
        return "Oponente Desconectado"
      default:
        return "Juego Pausado"
    }
  }

  const getMessage = () => {
    switch (reason) {
      case "manual":
        return "El juego está pausado. Puedes continuar cuando estés listo."
      case "connection":
        return "Hay problemas con la conexión. El juego se reanudará automáticamente cuando se restablezca."
      case "opponent_left":
        return `${opponentName || "Tu oponente"} se desconectó. Esperando reconexión...`
      default:
        return "El juego está pausado temporalmente."
    }
  }

  const getIcon = () => {
    switch (reason) {
      case "manual":
        return <Pause className="h-16 w-16 text-amber-400" />
      case "connection":
        return <RefreshCw className="h-16 w-16 text-yellow-400 animate-spin" />
      case "opponent_left":
        return <RefreshCw className="h-16 w-16 text-red-400 animate-pulse" />
      default:
        return <Pause className="h-16 w-16 text-gray-400" />
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md bg-black/90 border-2 border-amber-500/50 shadow-2xl">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            {getIcon()}
            <h2 className="text-2xl font-bold text-white mt-4 mb-2">{getTitle()}</h2>
            <p className="text-gray-300 text-sm leading-relaxed">{getMessage()}</p>
          </div>

          <div className="space-y-3">
            {reason === "manual" && (
              <Button
                onClick={onResume}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12 text-base rounded-xl"
              >
                <Play className="h-5 w-5 mr-2" />
                Continuar Juego
              </Button>
            )}

            {reason === "connection" && onReconnect && (
              <Button
                onClick={onReconnect}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 text-base rounded-xl"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Intentar Reconectar
              </Button>
            )}

            {reason === "opponent_left" && (
              <div className="bg-yellow-600/20 border border-yellow-600/50 rounded-xl p-4 mb-4">
                <p className="text-yellow-200 text-sm">Esperando que {opponentName || "tu oponente"} se reconecte...</p>
                <div className="flex justify-center mt-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={onBackToMenu}
              variant="outline"
              className="w-full border-gray-500 text-gray-300 hover:bg-gray-500/20 h-12 text-base rounded-xl bg-transparent"
            >
              <Home className="h-5 w-5 mr-2" />
              Volver al Menú
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
