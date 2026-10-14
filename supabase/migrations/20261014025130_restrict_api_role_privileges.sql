-- RLS never applies to TRUNCATE, and the API roles never need TRIGGER or
-- REFERENCES. create_games_and_scores only revoked insert/update/delete, so
-- Supabase's default grants left these in place. Policies must be the only
-- write path (spec 23).
revoke truncate, trigger, references
  on public.games, public.scores, public.profiles
  from anon, authenticated;

-- Both views aggregate or rank, so they are read-only anyway: keep only SELECT.
revoke insert, update, delete, truncate, trigger, references
  on public.games_with_stats, public.scores_ranked
  from anon, authenticated;

-- Scores: callers set only what the policies check. id and created_at always
-- come from their defaults, so nobody can backdate a row to win a tie.
revoke insert on public.scores from anon, authenticated;
grant insert (game_id, player_name, score, user_id) on public.scores to anon, authenticated;

-- New public tables created by migrations (role postgres) stop inheriting
-- TRUNCATE/TRIGGER/REFERENCES for the API roles.
alter default privileges for role postgres in schema public
  revoke truncate, trigger, references on tables from anon, authenticated;
