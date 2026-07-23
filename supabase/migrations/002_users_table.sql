-- Ensure core extension
create extension if not exists pgcrypto;

-- App users profile table used by frontend queries
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

-- Any signed-in user can read usernames (used for rankings and membership views)
drop policy if exists "Users can read users" on public.users;
create policy "Users can read users"
  on public.users for select
  to authenticated
  using (true);

-- A user can create/update their own profile row
 drop policy if exists "Users can insert own user row" on public.users;
create policy "Users can insert own user row"
  on public.users for insert
  to authenticated
  with check (auth.uid() = id);

 drop policy if exists "Users can update own user row" on public.users;
create policy "Users can update own user row"
  on public.users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Automatically create a public.users row when auth signup succeeds
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, username)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
