-- Tetris is re-added later through its own spec; until then it must not exist as playable without an engine.
delete from public.games where id = 'tetris';
