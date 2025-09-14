"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

interface Notification {
  id: string
  type: "info" | "success" | "warning" | "error"
  title: string
  message?: string
  duration?: number
}

interface GameNotificationsProps {
  notifications: Notification[]
  onRemove: (id: string) => void
}

export default function GameNotifications({ notifications, onRemove }: GameNotificationsProps) {
  useEffect(() => {
    notifications.forEach((notification) => {
      if (notification.duration !== 0) {
        const timer = setTimeout(() => {
          onRemove(notification.id)
        }, notification.duration || 3000)

        return () => clearTimeout(timer)
      }
    })
  }, [notifications, onRemove])

  const getNotificationStyles = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-600 border-green-500 text-white"
      case "warning":
        return "bg-yellow-600 border-yellow-500 text-white"
      case "error":
        return "bg-red-600 border-red-500 text-white"
      default:
        return "bg-blue-600 border-blue-500 text-white"
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            max-w-sm p-4 rounded-lg border-2 shadow-lg
            transform transition-all duration-300 ease-in-out
            ${getNotificationStyles(notification.type)}
          `}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-bold text-sm">{notification.title}</h4>
              {notification.message && (
                <p className="text-xs mt-1 opacity-90">{notification.message}</p>
              )}
            </div>
            <button
              onClick={() => onRemove(notification.id)}
              className="ml-2 p-1 hover:bg-white/20 rounded"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// Hook para manejar notificaciones
export function useGameNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = (notification: Omit<Notification, "id">) => {
    const id = Date.now().toString()
    setNotifications(prev => [...prev, { ...notification, id }])
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const showEnvidoResult = (player1Name: string, player2Name: string, player1Points: number, player2Points: number, winner: number, pointsAwarded: number) => {
    const winnerName = winner === 0 ? player1Name : player2Name
    addNotification({
      type: "success",
      title: "¡Envido!",
      message: `${player1Name}: ${player1Points} - ${player2Name}: ${player2Points}. ¡Gana ${winnerName}! +${pointsAwarded} puntos`,
      duration: 5000
    })
  }

  const showCantoNotification = (cantante: string, canto: string) => {
    addNotification({
      type: "info",
      title: `¡${canto}!`,
      message: `${cantante} cantó ${canto}`,
      duration: 3000
    })
  }

  const showTurnNotification = (message: string) => {
    addNotification({
      type: "warning",
      title: message,
      duration: 2000
    })
  }

  return {
    notifications,
    addNotification,
    removeNotification,
    showEnvidoResult,
    showCantoNotification,
    showTurnNotification
  }
}
