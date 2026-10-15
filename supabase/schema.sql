-- Plantain Butler — database schema
-- Idempotent: safe to run more than once.
-- Data belongs to a household; a user sees only households they are a member of.

create extension if not exists pgcrypto;

-- ---------- households ----------
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'My household',
  profile     jsonb not null default '{}'::jsonb,   -- onboarding answers, monthly budget, stores …
  budgets     jsonb not null default '{}'::jsonb,   -- per-category budgets
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists household_members_user_idx on public.household_members(user_id);

-- ---------- household data ----------
create table if not exists public.inventory_items (
  id             text primary key,
  household_id   uuid not null references public.households(id) on delete cascade,
  name           text not null,
  qty            numeric not null default 0,
  category       text not null default 'Other',
  status         text not null default 'high' check (status in ('high', 'medium', 'low')),
  last_price     numeric,
  last_purchased date,
  store          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists inventory_items_household_idx on public.inventory_items(household_id);

create table if not exists public.transactions (
  id            text primary key,
  household_id  uuid not null references public.households(id) on delete cascade,
  item          text not null,
  qty           numeric not null default 1,
  price         numeric not null default 0,
  category      text not null default 'Other',
  store         text,
  date          date not null default current_date,
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists transactions_household_date_idx on public.transactions(household_id, date desc);

create table if not exists public.shopping_items (
  id            text primary key,
  household_id  uuid not null references public.households(id) on delete cascade,
  name          text not null,
  qty           numeric not null default 1,
  est_price     numeric not null default 0,
  category      text not null default 'Other',
  store         text,
  checked       boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists shopping_items_household_idx on public.shopping_items(household_id);

-- AI requests per user per day (written only by the server, for the daily cap)
create table if not exists public.ai_usage (
  user_id  uuid not null references auth.users(id) on delete cascade,
  day      date not null default current_date,
  requests integer not null default 0,
  primary key (user_id, day)
);

-- ---------- updated_at ----------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['households', 'inventory_items', 'transactions', 'shopping_items'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------- membership helpers ----------
create or replace function public.is_household_member(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members m where m.household_id = hid and m.user_id = auth.uid())
$$;

-- Returns the caller's household, creating one (with them as owner) on first use.
create or replace function public.ensure_household() returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select household_id into hid from public.household_members where user_id = auth.uid() order by created_at limit 1;
  if hid is null then
    insert into public.households (created_by) values (auth.uid()) returning id into hid;
    insert into public.household_members (household_id, user_id, role) values (hid, auth.uid(), 'owner');
  end if;
  return hid;
end $$;

-- Daily AI cap. Called by the server with the service key; returns true if the request is allowed.
create or replace function public.bump_ai_usage(uid uuid, daily_limit integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.ai_usage (user_id, day, requests) values (uid, current_date, 1)
  on conflict (user_id, day) do update set requests = public.ai_usage.requests + 1
  returning requests into n;
  return n <= daily_limit;
end $$;

revoke all on function public.bump_ai_usage(uuid, integer) from public, anon, authenticated;
grant execute on function public.ensure_household() to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;

-- ---------- row-level security ----------
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.inventory_items   enable row level security;
alter table public.transactions      enable row level security;
alter table public.shopping_items    enable row level security;
alter table public.ai_usage          enable row level security;   -- no policies: clients can't touch it

drop policy if exists households_select on public.households;
create policy households_select on public.households for select to authenticated using (public.is_household_member(id));
drop policy if exists households_update on public.households;
create policy households_update on public.households for update to authenticated
  using (public.is_household_member(id)) with check (public.is_household_member(id));

drop policy if exists members_select on public.household_members;
create policy members_select on public.household_members for select to authenticated
  using (user_id = auth.uid() or public.is_household_member(household_id));

do $$
declare t text;
begin
  foreach t in array array['inventory_items', 'transactions', 'shopping_items'] loop
    execute format('drop policy if exists %I_all on public.%I', t, t);
    execute format(
      'create policy %I_all on public.%I for all to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))',
      t, t);
  end loop;
end $$;

grant select, update on public.households to authenticated;
grant select on public.household_members to authenticated;
grant select, insert, update, delete on public.inventory_items, public.transactions, public.shopping_items to authenticated;
revoke all on public.households, public.household_members, public.inventory_items, public.transactions, public.shopping_items, public.ai_usage from anon;
