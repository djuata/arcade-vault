create view public.games_with_stats
with (security_invoker = true) as
select
  g.*,
  coalesce(max(s.score), 0)::integer as best_score,
  count(s.id)::integer               as plays_count
from public.games g
left join public.scores s on s.game_id = g.id
group by g.id;

create view public.scores_ranked
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
  ))::integer as rank
from public.scores s;

grant select on public.games_with_stats, public.scores_ranked to anon, authenticated;
