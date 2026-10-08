delete from public.games
where id in ('bloque-buster', 'caida', 'serpentina', 'gloton', 'invasores', 'ranaria', 'duelo-pixel')
  and not playable;
