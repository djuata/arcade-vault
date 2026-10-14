-- OAuth sign-ups (Google/GitHub) carry no username: skip the profile and let
-- the player pick one on /login/nombre (spec 20). Email sign-ups still send it
-- and keep failing on the CHECK / unique index exactly as before.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := upper(btrim(new.raw_user_meta_data ->> 'username'));
begin
  if wanted is null or wanted = '' then
    return new;
  end if;

  insert into public.profiles (id, username) values (new.id, wanted);
  return new;
end;
$$;

-- A signed-in user without a profile creates exactly their own row, once (PK).
-- No update/delete grants: the username is permanent.
grant insert (id, username) on public.profiles to authenticated;

create policy "players create their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));
