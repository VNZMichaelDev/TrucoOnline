"use client"

import { cn } from "@/lib/utils"

interface CardBackProps {
  className?: string
  size?: "small" | "medium" | "large"
}

export default function CardBack({ className, size = "medium" }: CardBackProps) {
  const sizeClasses = {
    small: "w-12 h-18",
    medium: "w-16 h-24 md:w-20 md:h-28",
    large: "w-20 h-28 md:w-24 md:h-32",
  }

  return (
    <div
      className={cn(
        "relative rounded-lg shadow-lg border border-amber-600/30 bg-gradient-to-br from-red-800 to-red-900",
        sizeClasses[size],
        className,
      )}
    >
      <div className="absolute inset-2 border-2 border-amber-400/50 rounded-md">
        <div className="w-full h-full bg-gradient-to-br from-red-700 to-red-800 rounded-sm flex items-center justify-center">
          <div className="text-amber-200 text-xs font-bold transform rotate-45">TRUCO</div>
        </div>
      </div>
    </div>
  )
}
