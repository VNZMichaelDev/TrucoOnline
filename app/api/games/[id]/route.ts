import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient()
    const gameId = params.id

    const { data: gameRoom, error } = await supabase.from("game_rooms").select("*").eq("id", gameId).single()

    if (error) throw error

    return NextResponse.json({ gameRoom })
  } catch (error) {
    console.error("Error fetching game:", error)
    return NextResponse.json({ error: "Error fetching game" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createServerClient()
    const gameId = params.id
    const { gameState, status } = await request.json()

    const updateData: any = {}
    if (gameState) updateData.game_state = gameState
    if (status) updateData.status = status

    const { data: updatedRoom, error } = await supabase
      .from("game_rooms")
      .update(updateData)
      .eq("id", gameId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ gameRoom: updatedRoom })
  } catch (error) {
    console.error("Error updating game:", error)
    return NextResponse.json({ error: "Error updating game" }, { status: 500 })
  }
}
