"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface MainMenuProps {
  playerName: string
  onStartMatchmaking: () => void
  onOpenSettings: () => void
}

export default function MainMenu({ playerName, onStartMatchmaking, onOpenSettings }: MainMenuProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage:
          "url(https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fondomenuprincipal.jpg-Ga2pUnRel8thNe4kscmoDlG2Gd5pZJ.jpeg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <Card className="w-full max-w-sm mx-4 bg-black/80 border-amber-600 shadow-2xl">
        <CardContent className="p-8 text-center">
          <h1 className="text-4xl font-bold text-amber-200 mb-8">Truco Argentino</h1>
          <p className="text-amber-100 mb-8 text-xl">¡Hola {playerName}!</p>
          <div className="space-y-6">
            <Button
              className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xl font-bold h-14 rounded-xl shadow-lg transform active:scale-95 transition-all"
              onClick={onStartMatchmaking}
            >
              🎮 Partida Rápida
            </Button>
            <Button
              variant="outline"
              className="w-full border-2 border-amber-600 text-amber-200 hover:bg-amber-600/20 text-xl font-bold h-14 bg-transparent rounded-xl"
              onClick={onOpenSettings}
            >
              ⚙️ Ajustes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
