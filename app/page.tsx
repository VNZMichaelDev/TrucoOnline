"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import MainMenu from "@/components/main-menu"
import GameScreen from "@/components/game-screen"
import OnlineGameScreen from "@/components/online-game-screen"
import SettingsScreen from "@/components/settings-screen"

type Screen = "name-entry" | "main-menu" | "game" | "online-game" | "settings"

export default function HomePage() {
  const [playerName, setPlayerName] = useState("")
  const [currentScreen, setCurrentScreen] = useState<Screen>("name-entry")

  const handleNameSubmit = () => {
    if (playerName.trim()) {
      setCurrentScreen("main-menu")
    }
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case "name-entry":
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
                <h1 className="text-3xl font-bold text-amber-200 mb-8">Bienvenido al Truco</h1>
                <div className="space-y-6">
                  <Input
                    type="text"
                    placeholder="Ingresa tu nombre"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="bg-amber-50 border-amber-600 text-black text-lg h-12 px-4"
                    onKeyPress={(e) => e.key === "Enter" && handleNameSubmit()}
                  />
                  <Button
                    onClick={handleNameSubmit}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white text-lg font-bold h-12"
                    disabled={!playerName.trim()}
                  >
                    Continuar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case "main-menu":
        return (
          <MainMenu
            playerName={playerName}
            onStartGame={() => setCurrentScreen("game")}
            onStartOnlineGame={() => setCurrentScreen("online-game")}
            onOpenSettings={() => setCurrentScreen("settings")}
          />
        )

      case "game":
        return <GameScreen playerName={playerName} onBackToMenu={() => setCurrentScreen("main-menu")} />

      case "online-game":
        return <OnlineGameScreen playerName={playerName} onBackToMenu={() => setCurrentScreen("main-menu")} />

      case "settings":
        return <SettingsScreen onBackToMenu={() => setCurrentScreen("main-menu")} />

      default:
        return null
    }
  }

  return renderScreen()
}
