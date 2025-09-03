"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Wifi, WifiOff, AlertTriangle, RefreshCw } from "lucide-react"
import type { ConnectionStatus } from "@/lib/websocket-manager"

interface ConnectionStatusProps {
  status: ConnectionStatus
  latency: number
  onReconnect: () => void
  onBackToMenu: () => void
}

export default function ConnectionStatusComponent({
  status,
  latency,
  onReconnect,
  onBackToMenu,
}: ConnectionStatusProps) {
  const [showDetails, setShowDetails] = useState(false)

  const getStatusColor = () => {
    switch (status) {
      case "connected":
        return "text-green-400"
      case "connecting":
      case "reconnecting":
        return "text-yellow-400"
      case "disconnected":
        return "text-red-400"
      default:
        return "text-gray-400"
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case "connected":
        return <Wifi className="h-4 w-4" />
      case "connecting":
      case "reconnecting":
        return <RefreshCw className="h-4 w-4 animate-spin" />
      case "disconnected":
        return <WifiOff className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case "connected":
        return "Conectado"
      case "connecting":
        return "Conectando..."
      case "reconnecting":
        return "Reconectando..."
      case "disconnected":
        return "Desconectado"
      default:
        return "Estado desconocido"
    }
  }

  const getLatencyColor = () => {
    if (latency < 100) return "text-green-400"
    if (latency < 300) return "text-yellow-400"
    return "text-red-400"
  }

  if (status === "disconnected") {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-md bg-black/90 border-2 border-red-500/50 shadow-2xl">
          <CardContent className="p-6 text-center">
            <div className="mb-4">
              <WifiOff className="h-16 w-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Conexión Perdida</h2>
              <p className="text-gray-300 text-sm">
                Se perdió la conexión con el servidor. No puedes continuar jugando sin conexión.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                onClick={onReconnect}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 rounded-xl"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Intentar Reconectar
              </Button>
              <Button
                onClick={onBackToMenu}
                variant="outline"
                className="w-full border-gray-500 text-gray-300 hover:bg-gray-500/20 h-11 rounded-xl bg-transparent"
              >
                Volver al Menú
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDetails(!showDetails)}
        className={`${getStatusColor()} hover:bg-white/10 h-8 px-2 rounded-lg`}
      >
        {getStatusIcon()}
        <span className="ml-1 text-xs font-medium">{getStatusText()}</span>
        {status === "connected" && latency > 0 && (
          <span className={`ml-1 text-xs ${getLatencyColor()}`}>{latency}ms</span>
        )}
      </Button>

      {showDetails && (
        <div className="absolute top-16 right-3 z-40">
          <Card className="bg-black/90 border border-amber-500/50 shadow-xl">
            <CardContent className="p-3 text-xs">
              <div className="space-y-2 min-w-32">
                <div className="flex justify-between">
                  <span className="text-gray-400">Estado:</span>
                  <span className={getStatusColor()}>{getStatusText()}</span>
                </div>
                {status === "connected" && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Latencia:</span>
                      <span className={getLatencyColor()}>{latency}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Calidad:</span>
                      <span className={getLatencyColor()}>
                        {latency < 100 ? "Excelente" : latency < 300 ? "Buena" : "Lenta"}
                      </span>
                    </div>
                  </>
                )}
                {status === "reconnecting" && (
                  <div className="text-center">
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto text-yellow-400" />
                    <p className="text-yellow-400 mt-1">Reintentando...</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
