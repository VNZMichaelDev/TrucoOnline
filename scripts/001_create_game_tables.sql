-- Create players table for user profiles
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0
);

-- Create game_rooms table for active games
CREATE TABLE IF NOT EXISTS public.game_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  player2_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
  current_game_state JSONB,
  winner_id UUID REFERENCES public.players(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create game_moves table for real-time moves
CREATE TABLE IF NOT EXISTS public.game_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  move_type TEXT NOT NULL,
  move_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create matchmaking_queue table
CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for players
CREATE POLICY "Players can view all players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Players can insert their own profile" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Players can update their own profile" ON public.players FOR UPDATE USING (true);

-- RLS Policies for game_rooms
CREATE POLICY "Players can view their own games" ON public.game_rooms FOR SELECT USING (
  player1_id IN (SELECT id FROM public.players WHERE username = current_setting('app.current_username', true)) OR
  player2_id IN (SELECT id FROM public.players WHERE username = current_setting('app.current_username', true))
);
CREATE POLICY "Players can update their own games" ON public.game_rooms FOR UPDATE USING (
  player1_id IN (SELECT id FROM public.players WHERE username = current_setting('app.current_username', true)) OR
  player2_id IN (SELECT id FROM public.players WHERE username = current_setting('app.current_username', true))
);
CREATE POLICY "System can insert game rooms" ON public.game_rooms FOR INSERT WITH CHECK (true);

-- RLS Policies for game_moves
CREATE POLICY "Players can view moves in their games" ON public.game_moves FOR SELECT USING (
  room_id IN (
    SELECT id FROM public.game_rooms WHERE 
    player1_id IN (SELECT id FROM public.players WHERE username = current_setting('app.current_username', true)) OR
    player2_id IN (SELECT id FROM public.players WHERE username = current_setting('app.current_username', true))
  )
);
CREATE POLICY "Players can insert moves in their games" ON public.game_moves FOR INSERT WITH CHECK (
  room_id IN (
    SELECT id FROM public.game_rooms WHERE 
    player1_id IN (SELECT id FROM public.players WHERE username = current_setting('app.current_username', true)) OR
    player2_id IN (SELECT id FROM public.players WHERE username = current_setting('app.current_username', true))
  )
);

-- RLS Policies for matchmaking_queue
CREATE POLICY "Players can view queue" ON public.matchmaking_queue FOR SELECT USING (true);
CREATE POLICY "Players can insert into queue" ON public.matchmaking_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Players can delete from queue" ON public.matchmaking_queue FOR DELETE USING (
  player_id IN (SELECT id FROM public.players WHERE username = current_setting('app.current_username', true))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON public.game_rooms(status);
CREATE INDEX IF NOT EXISTS idx_game_rooms_players ON public.game_rooms(player1_id, player2_id);
CREATE INDEX IF NOT EXISTS idx_game_moves_room ON public.game_moves(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_created ON public.matchmaking_queue(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for game_rooms updated_at
CREATE TRIGGER update_game_rooms_updated_at BEFORE UPDATE ON public.game_rooms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
