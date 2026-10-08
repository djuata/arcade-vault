-- Template: supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql
-- Apply with the Supabase MCP `apply_migration` AND save the same SQL in the repo
-- (rename the file to the version `list_migrations` reports: it is UTC).
-- The registry entry in lib/games/registry.ts ships in the same change.
-- Every game is a brand-new catalog row (the catalog has no placeholders).

-- cat   ∈ 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS'
-- color ∈ 'cyan' | 'magenta' | 'yellow' | 'green'
-- cover = CSS class that must exist in app/globals.css (e.g. 'cover-<slug>')
-- sort_order: unique; check `select id, sort_order from public.games order by 2` first.
insert into public.games (id, title, short, long, cat, cover, color, playable, sort_order)
values ('<slug>', 'TITLE', 'Short tagline.', 'Long description.', 'ARCADE', 'cover-<slug>', 'cyan', true, 12);

-- Verify:
-- select id, playable from public.games where id = '<slug>';
