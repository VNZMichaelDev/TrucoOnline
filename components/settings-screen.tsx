"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Volume2, VolumeX, Music, Zap } from "lucide-react"
import { useAudio } from "@/hooks/use-audio"

interface SettingsScreenProps {
  onBackToMenu: () => void
}

export default function SettingsScreen({ onBackToMenu }: SettingsScreenProps) {
  const { settings, updateSettings, playSound } = useAudio()
  const [localMusicVolume, setLocalMusicVolume] = useState([settings.musicVolume])
  const [localSoundVolume, setLocalSoundVolume] = useState([settings.soundEffectsVolume])

  // Update local state when settings change
  useEffect(() => {
    setLocalMusicVolume([settings.musicVolume])
    setLocalSoundVolume([settings.soundEffectsVolume])
  }, [settings])

  const handleMusicVolumeChange = (value: number[]) => {
    setLocalMusicVolume(value)
    updateSettings({ musicVolume: value[0] })
  }

  const handleSoundVolumeChange = (value: number[]) => {
    setLocalSoundVolume(value)
    updateSettings({ soundEffectsVolume: value[0] })
    // Play test sound when adjusting volume
    playSound("cardPlay")
  }

  const handleMusicToggle = (enabled: boolean) => {
    updateSettings({ musicEnabled: enabled })
  }

  const handleSoundEffectsToggle = (enabled: boolean) => {
    updateSettings({ soundEffectsEnabled: enabled })
  }

  const testSound = () => {
    playSound("truco")
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage:
          "url(https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fondojuego.jpg-aASnDGPRF1q77ESLQSAJr6YUx7O1sJ.jpeg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <Card className="w-full max-w-sm mx-4 bg-black/80 border-amber-600 shadow-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBackToMenu}
              className="text-amber-200 hover:bg-amber-600/20 h-10 w-10"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <CardTitle className="text-xl font-bold text-amber-200">Ajustes de Audio</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 px-6">
          {/* Music Settings */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Music className="h-6 w-6 text-amber-200" />
                <label className="text-amber-200 font-medium text-lg">Música de Fondo</label>
              </div>
              <Switch checked={settings.musicEnabled} onCheckedChange={handleMusicToggle} className="scale-125" />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {localMusicVolume[0] === 0 || !settings.musicEnabled ? (
                  <VolumeX className="h-5 w-5 text-amber-200" />
                ) : (
                  <Volume2 className="h-5 w-5 text-amber-200" />
                )}
                <span className="text-amber-300 text-base">Volumen</span>
              </div>
              <div className="px-2">
                <Slider
                  value={localMusicVolume}
                  onValueChange={handleMusicVolumeChange}
                  max={100}
                  step={5}
                  className="w-full h-6"
                  disabled={!settings.musicEnabled}
                />
                <div className="flex justify-between text-base text-amber-300 mt-2">
                  <span>0%</span>
                  <span className="font-bold">{localMusicVolume[0]}%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sound Effects Settings */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-6 w-6 text-amber-200" />
                <label className="text-amber-200 font-medium text-lg">Efectos de Sonido</label>
              </div>
              <Switch
                checked={settings.soundEffectsEnabled}
                onCheckedChange={handleSoundEffectsToggle}
                className="scale-125"
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {localSoundVolume[0] === 0 || !settings.soundEffectsEnabled ? (
                  <VolumeX className="h-5 w-5 text-amber-200" />
                ) : (
                  <Volume2 className="h-5 w-5 text-amber-200" />
                )}
                <span className="text-amber-300 text-base">Volumen</span>
              </div>
              <div className="px-2">
                <Slider
                  value={localSoundVolume}
                  onValueChange={handleSoundVolumeChange}
                  max={100}
                  step={5}
                  className="w-full h-6"
                  disabled={!settings.soundEffectsEnabled}
                />
                <div className="flex justify-between text-base text-amber-300 mt-2">
                  <span>0%</span>
                  <span className="font-bold">{localSoundVolume[0]}%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* Test Sound Button */}
            <Button
              onClick={testSound}
              variant="outline"
              className="w-full border-2 border-amber-600 text-amber-200 hover:bg-amber-600/20 bg-transparent h-12 text-base font-bold rounded-lg"
              disabled={!settings.soundEffectsEnabled}
            >
              Probar Sonido
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 space-y-4">
            <Button
              onClick={onBackToMenu}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white h-12 text-lg font-bold rounded-lg"
            >
              Guardar y Volver
            </Button>

            <div className="text-center">
              <p className="text-amber-300 text-sm">Los ajustes se guardan automáticamente</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
