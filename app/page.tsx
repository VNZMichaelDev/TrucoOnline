"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { createBrowserClient } from "@supabase/ssr"
import type { User } from "@supabase/supabase-js"
import MainMenu from "@/components/main-menu"
import GameScreen from "@/components/game-screen"
import OnlineGameScreen from "@/components/online-game-screen"
import SettingsScreen from "@/components/settings-screen"

type Screen = "loading" | "name-entry" | "main-menu" | "game" | "online-game" | "settings"

export default function HomePage() {
  const [playerName, setPlayerName] = useState("")
  const [currentScreen, setCurrentScreen] = useState<Screen>("loading")
  const [user, setUser] = useState<User | null>(null)
  const [supabase] = useState(() =>
    createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
  )

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          setUser(user)
          // Use email as default player name if no name is set
          if (!playerName && user.email) {
            setPlayerName(user.email.split("@")[0])
          }
          setCurrentScreen("name-entry")
        } else {
          // Redirect to login if not authenticated
          window.location.href = "/auth/login"
        }
      } catch (error) {
        console.error("Auth check failed:", error)
        window.location.href = "/auth/login"
      }
    }

    checkAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        window.location.href = "/auth/login"
      } else if (session?.user) {
        setUser(session.user)
        if (!playerName && session.user.email) {
          setPlayerName(session.user.email.split("@")[0])
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth, playerName])

  const handleNameSubmit = () => {
    if (playerName.trim()) {
      setCurrentScreen("main-menu")
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/auth/login"
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case "loading":
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
                <h1 className="text-3xl font-bold text-amber-200 mb-8">Cargando...</h1>
                <div className="animate-pulse">
                  <div className="h-2 bg-amber-600 rounded-full"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

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
                {user?.email && <p className="text-amber-300 text-sm mb-4">Conectado como: {user.email}</p>}
                <div className="space-y-6">
                  <Input
                    type="text"
                    placeholder="Ingresa tu nombre de jugador"
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
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full border-2 border-amber-600 text-amber-200 hover:bg-amber-600/20 font-bold h-10 bg-transparent"
                  >
                    Cerrar Sesión
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
        return (
          <OnlineGameScreen playerName={playerName} onBackToMenu={() => setCurrentScreen("main-menu")} user={user} />
        )

      case "settings":
        return <SettingsScreen onBackToMenu={() => setCurrentScreen("main-menu")} />

      default:
        return null
    }
  }

  return renderScreen()
}
