-- Template: supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql
-- Apply with the Supabase MCP `apply_migration` AND save the same SQL in the repo.
-- Pick ONE variant. The registry entry in lib/games/registry.ts ships in the same change.

-- ── Variant A: game already in the catalog (the 7 pending slugs) ──────────────
update public.games
   set playable = true
 where id = '<slug>';

-- ── Variant B: brand-new game (slug not in `games`) ───────────────────────────
-- cat   ∈ 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS'
-- color ∈ 'cyan' | 'magenta' | 'yellow' | 'green'
-- cover = CSS class that must exist in app/globals.css (e.g. 'cover-<slug>')
-- sort_order: unique; check `select id, sort_order from public.games order by 2` first.
-- insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order)
-- values ('<slug>', 'TITLE', 'Short tagline.', 'Long description.', 'ARCADE', 'cover-<slug>', 'cyan', true, 9);

-- Verify:
-- select id, playable from public.games where id = '<slug>';
