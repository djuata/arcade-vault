alter table public.scores
  add column user_id uuid references public.profiles(id) on delete set null;

create index scores_user_game_idx on public.scores (user_id, game_id);

drop policy "scores can be inserted for playable games" on public.scores;

create policy "guests insert scores with a free name"
  on public.scores for insert
  to anon
  with check (
    user_id is null
    and exists (select 1 from public.games g where g.id = scores.game_id and g.playable)
    and not exists (
      select 1 from public.profiles p
      where p.username = upper(btrim(scores.player_name))
    )
  );

create policy "players insert their own scores"
  on public.scores for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.games g where g.id = scores.game_id and g.playable)
    and player_name = (select p.username from public.profiles p where p.id = (select auth.uid()))
  );

-- New column appended at the end so `create or replace` is allowed.
create or replace view public.scores_ranked
with (security_invoker = true) as
select
  s.id,
  s.game_id,
  s.player_name,
  s.score,
  s.created_at,
  (row_number() over (
    partition by s.game_id
    order by s.score desc, s.created_at asc
  ))::integer as rank,
  s.user_id
from public.scores s;
