"use client"

export interface AudioSettings {
  musicVolume: number
  soundEffectsVolume: number
  musicEnabled: boolean
  soundEffectsEnabled: boolean
}

export class AudioManager {
  private static instance: AudioManager
  private settings: AudioSettings
  private backgroundMusic?: HTMLAudioElement
  private soundEffects: Map<string, HTMLAudioElement> = new Map()

  private constructor() {
    this.settings = this.loadSettings()
    this.initializeAudio()
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager()
    }
    return AudioManager.instance
  }

  private loadSettings(): AudioSettings {
    if (typeof window === "undefined") {
      return {
        musicVolume: 70,
        soundEffectsVolume: 80,
        musicEnabled: true,
        soundEffectsEnabled: true,
      }
    }

    const saved = localStorage.getItem("truco-audio-settings")
    if (saved) {
      return JSON.parse(saved)
    }

    return {
      musicVolume: 70,
      soundEffectsVolume: 80,
      musicEnabled: true,
      soundEffectsEnabled: true,
    }
  }

  private saveSettings(): void {
    if (typeof window !== "undefined") {
      localStorage.setItem("truco-audio-settings", JSON.stringify(this.settings))
    }
  }

  private initializeAudio(): void {
    if (typeof window === "undefined") return

    // Initialize background music (placeholder - you can add actual music files later)
    this.backgroundMusic = new Audio()
    this.backgroundMusic.loop = true
    this.backgroundMusic.volume = (this.settings.musicVolume / 100) * (this.settings.musicEnabled ? 1 : 0)

    // Initialize sound effects
    const soundEffectFiles = {
      cardPlay: "/sounds/card-play.mp3", // Placeholder paths
      truco: "/sounds/truco.mp3",
      envido: "/sounds/envido.mp3",
      win: "/sounds/win.mp3",
      lose: "/sounds/lose.mp3",
    }

    Object.entries(soundEffectFiles).forEach(([name, path]) => {
      const audio = new Audio(path)
      audio.volume = (this.settings.soundEffectsVolume / 100) * (this.settings.soundEffectsEnabled ? 1 : 0)
      this.soundEffects.set(name, audio)
    })
  }

  public getSettings(): AudioSettings {
    return { ...this.settings }
  }

  public updateSettings(newSettings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...newSettings }
    this.saveSettings()
    this.applyVolumeSettings()
  }

  private applyVolumeSettings(): void {
    if (this.backgroundMusic) {
      this.backgroundMusic.volume = (this.settings.musicVolume / 100) * (this.settings.musicEnabled ? 1 : 0)
    }

    this.soundEffects.forEach((audio) => {
      audio.volume = (this.settings.soundEffectsVolume / 100) * (this.settings.soundEffectsEnabled ? 1 : 0)
    })
  }

  public playBackgroundMusic(): void {
    if (this.backgroundMusic && this.settings.musicEnabled) {
      this.backgroundMusic.play().catch(() => {
        // Handle autoplay restrictions
        console.log("Background music autoplay blocked")
      })
    }
  }

  public stopBackgroundMusic(): void {
    if (this.backgroundMusic) {
      this.backgroundMusic.pause()
      this.backgroundMusic.currentTime = 0
    }
  }

  public playSoundEffect(name: string): void {
    if (!this.settings.soundEffectsEnabled) return

    const audio = this.soundEffects.get(name)
    if (audio) {
      audio.currentTime = 0
      audio.play().catch(() => {
        // Handle playback errors silently
      })
    }
  }

  public setMusicVolume(volume: number): void {
    this.updateSettings({ musicVolume: Math.max(0, Math.min(100, volume)) })
  }

  public setSoundEffectsVolume(volume: number): void {
    this.updateSettings({ soundEffectsVolume: Math.max(0, Math.min(100, volume)) })
  }

  public toggleMusic(): void {
    this.updateSettings({ musicEnabled: !this.settings.musicEnabled })
    if (!this.settings.musicEnabled) {
      this.stopBackgroundMusic()
    }
  }

  public toggleSoundEffects(): void {
    this.updateSettings({ soundEffectsEnabled: !this.settings.soundEffectsEnabled })
  }
}
