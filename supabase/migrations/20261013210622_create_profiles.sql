create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null
             check (username ~ '^[A-Z0-9_]{3,10}$' and username <> 'INVITADO'),
  created_at timestamptz not null default now()
);

create unique index profiles_username_key on public.profiles (username);

alter table public.profiles enable row level security;

-- Defense in depth: profiles are written only by the trigger below.
revoke insert, update, delete on public.profiles from anon, authenticated;

-- Public: the score modal and the sign-up form check username availability.
create policy "profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, upper(btrim(new.raw_user_meta_data ->> 'username')));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
