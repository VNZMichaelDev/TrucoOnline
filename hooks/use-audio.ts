"use client"

import { useState, useEffect } from "react"
import { AudioManager, type AudioSettings } from "@/lib/audio-manager"

export function useAudio() {
  const [settings, setSettings] = useState<AudioSettings>({
    musicVolume: 70,
    soundEffectsVolume: 80,
    musicEnabled: true,
    soundEffectsEnabled: true,
  })

  const [audioManager, setAudioManager] = useState<AudioManager | null>(null)

  useEffect(() => {
    const manager = AudioManager.getInstance()
    setAudioManager(manager)
    setSettings(manager.getSettings())
  }, [])

  const updateSettings = (newSettings: Partial<AudioSettings>) => {
    if (audioManager) {
      audioManager.updateSettings(newSettings)
      setSettings(audioManager.getSettings())
    }
  }

  const playSound = (soundName: string) => {
    if (audioManager) {
      audioManager.playSoundEffect(soundName)
    }
  }

  const startBackgroundMusic = () => {
    if (audioManager) {
      audioManager.playBackgroundMusic()
    }
  }

  const stopBackgroundMusic = () => {
    if (audioManager) {
      audioManager.stopBackgroundMusic()
    }
  }

  return {
    settings,
    updateSettings,
    playSound,
    startBackgroundMusic,
    stopBackgroundMusic,
  }
}
