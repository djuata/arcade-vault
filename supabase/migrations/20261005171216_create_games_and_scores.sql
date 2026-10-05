create table public.games (
  id         text primary key,
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover      text not null,
  color      text not null check (color in ('cyan','magenta','yellow','green')),
  playable   boolean not null default false,
  sort_order smallint not null,
  created_at timestamptz not null default now()
);

create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games(id),
  player_name text not null check (char_length(btrim(player_name)) between 1 and 10),
  score       integer not null check (score > 0 and score <= 99999999),
  created_at  timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc);

alter table public.games  enable row level security;
alter table public.scores enable row level security;

-- Defense in depth: no write grants beyond what the policies allow.
revoke insert, update, delete on public.games  from anon, authenticated;
revoke update, delete          on public.scores from anon, authenticated;

create policy "games are publicly readable"
  on public.games for select
  to anon, authenticated
  using (true);

create policy "scores are publicly readable"
  on public.scores for select
  to anon, authenticated
  using (true);

create policy "scores can be inserted for playable games"
  on public.scores for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.games g
      where g.id = scores.game_id and g.playable
    )
  );
