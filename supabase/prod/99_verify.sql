-- Run in the PROD SQL Editor AFTER `supabase db push`. Read-only.
-- Every row must come back with ok = true. Expected values were taken from
-- DEV on 2026-10-14 (after spec 23); update them when a migration changes
-- the catalog, policies or grants.

with checks(check_name, expected, actual) as (
  values
  ('migrations applied',
   '18',
   (select count(*)::text from supabase_migrations.schema_migrations)),

  ('games catalog (id:sort_order, all playable)',
   'rocas:6,tetris:9,arkanoid:10,snake:11,croac:12,frogger:13',
   (select string_agg(id || ':' || sort_order, ',' order by sort_order)
      from public.games where playable)),

  ('no non-playable games',
   '0',
   (select count(*)::text from public.games where not playable)),

  ('RLS enabled on every public table',
   'games,profiles,scores',
   (select string_agg(relname, ',' order by relname)
      from pg_class
     where relnamespace = 'public'::regnamespace and relkind = 'r' and relrowsecurity)),

  ('policies',
   'games:games are publicly readable:SELECT|'
   || 'profiles:players create their own profile:INSERT|'
   || 'profiles:profiles are publicly readable:SELECT|'
   || 'scores:guests insert scores with a free name:INSERT|'
   || 'scores:players insert their own scores:INSERT|'
   || 'scores:scores are publicly readable:SELECT',
   (select string_agg(tablename || ':' || policyname || ':' || cmd, '|' order by tablename, policyname)
      from pg_policies where schemaname = 'public')),

  ('API roles: table-level grants are SELECT only',
   'anon:SELECT,authenticated:SELECT',
   (select string_agg(distinct grantee || ':' || privilege_type, ',')
      from information_schema.role_table_grants
     where table_schema = 'public' and grantee in ('anon', 'authenticated'))),

  ('scores: column INSERT grants',
   'anon:game_id,anon:player_name,anon:score,anon:user_id,'
   || 'authenticated:game_id,authenticated:player_name,authenticated:score,authenticated:user_id',
   (select string_agg(grantee || ':' || column_name, ',' order by grantee, column_name)
      from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'scores'
       and privilege_type = 'INSERT' and grantee in ('anon', 'authenticated'))),

  ('profiles: column INSERT grants',
   'authenticated:id,authenticated:username',
   (select string_agg(grantee || ':' || column_name, ',' order by grantee, column_name)
      from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'profiles'
       and privilege_type = 'INSERT' and grantee in ('anon', 'authenticated'))),

  ('SECURITY DEFINER functions not executable by API roles',
   'handle_new_user:false:false,rls_auto_enable:false:false',
   (select string_agg(proname || ':' || has_function_privilege('anon', oid, 'execute')
                      || ':' || has_function_privilege('authenticated', oid, 'execute'),
                      ',' order by proname)
      from pg_proc where pronamespace = 'public'::regnamespace and prosecdef)),

  ('trigger on auth.users',
   'on_auth_user_created',
   (select string_agg(tgname, ',') from pg_trigger
     where tgrelid = 'auth.users'::regclass and not tgisinternal)),

  ('event trigger ensure_rls',
   'ensure_rls:O',
   (select string_agg(evtname || ':' || evtenabled::text, ',') from pg_event_trigger
     where evtname = 'ensure_rls')),

  ('views are security_invoker',
   'games_with_stats,scores_ranked',
   (select string_agg(relname, ',' order by relname) from pg_class
     where relnamespace = 'public'::regnamespace and relkind = 'v'
       and 'security_invoker=true' = any (reloptions))),

  ('no leftover DEV data (profiles, scores)',
   '0,0',
   (select (select count(*) from public.profiles) || ',' || (select count(*) from public.scores)))
)
select check_name, expected = coalesce(actual, '') as ok, expected, actual
from checks;
