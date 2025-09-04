import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const username = searchParams.get("username")

    if (username) {
      // Buscar jugador por username
      const { data: player, error } = await supabase.from("players").select("*").eq("username", username).single()

      if (error && error.code !== "PGRST116") {
        throw error
      }

      return NextResponse.json({ player })
    }

    // Obtener todos los jugadores
    const { data: players, error } = await supabase
      .from("players")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ players })
  } catch (error) {
    console.error("Error fetching players:", error)
    return NextResponse.json({ error: "Error fetching players" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { username } = await request.json()

    if (!username) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 })
    }

    // Verificar si el jugador ya existe
    const { data: existingPlayer } = await supabase.from("players").select("*").eq("username", username).single()

    if (existingPlayer) {
      // Actualizar last_seen
      const { data: updatedPlayer, error } = await supabase
        .from("players")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", existingPlayer.id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ player: updatedPlayer })
    }

    const { data: newPlayer, error } = await supabase
      .from("players")
      .insert([
        {
          id: user.id, // Usar el ID del usuario autenticado
          username,
          games_played: 0,
        },
      ])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ player: newPlayer })
  } catch (error) {
    console.error("Error creating/updating player:", error)
    return NextResponse.json({ error: "Error creating/updating player" }, { status: 500 })
  }
}
