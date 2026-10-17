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
-- How many you usually have when fully stocked (set on purchase); drives automatic running-low
alter table public.inventory_items add column if not exists full_qty numeric;
-- Date someone said "still got plenty" to a past-its-usual-rebuy-time nudge
alter table public.inventory_items add column if not exists due_ack date;

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

-- Returns the caller's active household (the one they joined most recently), creating one
-- (with them as owner) on first use.
create or replace function public.ensure_household() returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select household_id into hid from public.household_members where user_id = auth.uid() order by created_at desc limit 1;
  if hid is null then
    insert into public.households (created_by) values (auth.uid()) returning id into hid;
    insert into public.household_members (household_id, user_id, role) values (hid, auth.uid(), 'owner');
  end if;
  return hid;
end $$;

-- Daily AI cap. The server calls this with the signed-in user's token; it counts the
-- request against that user only and returns today's total. Calling it directly can
-- only ever use up the caller's own allowance.
drop function if exists public.bump_ai_usage(uuid, integer);
create or replace function public.bump_ai_usage() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.ai_usage (user_id, day, requests) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set requests = public.ai_usage.requests + 1
  returning requests into n;
  return n;
end $$;

revoke all on function public.bump_ai_usage() from public, anon;
grant execute on function public.bump_ai_usage() to authenticated;
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
revoke all on public.ai_usage from authenticated;

-- =====================================================================
-- v3 — brands & product types, learned usage, household sharing
-- Everything below only ADDS columns, tables and functions. Updates to this
-- file must never drop or rewrite existing data.
-- =====================================================================
alter table public.inventory_items add column if not exists brand text;
alter table public.inventory_items add column if not exists product_type text;
alter table public.transactions    add column if not exists brand text;
alter table public.transactions    add column if not exists product_type text;
-- What Butler has learned about how fast the household uses each product type
alter table public.households add column if not exists learning jsonb not null default '{}'::jsonb;

-- Invite codes. Clients never touch this table directly — only through the functions below.
create table if not exists public.household_invites (
  code         text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  created_by   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  used_by      uuid references auth.users(id) on delete set null,
  used_at      timestamptz
);
create index if not exists household_invites_household_idx on public.household_invites(household_id);
-- Failed/attempted joins per user per day, to stop code guessing
create table if not exists public.join_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default current_date,
  n       integer not null default 0,
  primary key (user_id, day)
);
alter table public.household_invites enable row level security;
alter table public.join_attempts     enable row level security;
revoke all on public.household_invites, public.join_attempts from anon, authenticated;

-- New invite code for the caller's active household (any member can invite).
create or replace function public.create_invite() returns json
language plpgsql security definer set search_path = public as $$
declare hid uuid; c text; b bytea; i int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  hid := public.ensure_household();
  delete from public.household_invites hi where hi.household_id = hid and hi.used_by is null and hi.expires_at < now();
  -- keep at most 5 open codes per household
  delete from public.household_invites where code in (
    select hi.code from public.household_invites hi where hi.household_id = hid and hi.used_by is null
    order by hi.created_at desc offset 4);
  loop
    b := uuid_send(gen_random_uuid()); c := '';
    for i in 0..5 loop c := c || substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 31), 1); end loop;
    begin
      insert into public.household_invites (code, household_id) values (c, hid);
      exit;
    exception when unique_violation then -- try another code
    end;
  end loop;
  return json_build_object('code', c, 'expires_at', now() + interval '7 days');
end $$;

-- Join with a code. Returns {status: ok|invalid|already|limit, household_id}.
create or replace function public.join_household(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare inv public.household_invites; tries int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.join_attempts (user_id, day, n) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set n = public.join_attempts.n + 1 returning n into tries;
  if tries > 10 then return json_build_object('status', 'limit'); end if;
  select * into inv from public.household_invites where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) for update;
  if not found or inv.used_by is not null or inv.expires_at < now() then return json_build_object('status', 'invalid'); end if;
  if exists (select 1 from public.household_members where household_id = inv.household_id and user_id = auth.uid()) then
    return json_build_object('status', 'already', 'household_id', inv.household_id);
  end if;
  insert into public.household_members (household_id, user_id, role) values (inv.household_id, auth.uid(), 'member');
  update public.household_invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return json_build_object('status', 'ok', 'household_id', inv.household_id);
end $$;

-- Leave the active household (owners can't leave their own; they remove others instead).
create or replace function public.leave_household() returns json
language plpgsql security definer set search_path = public as $$
declare hid uuid; r text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  hid := public.ensure_household();
  select role into r from public.household_members where household_id = hid and user_id = auth.uid();
  if r = 'owner' then return json_build_object('status', 'owner'); end if;
  delete from public.household_members where household_id = hid and user_id = auth.uid();
  return json_build_object('status', 'ok', 'household_id', public.ensure_household());
end $$;

-- Owner removes someone from the active household.
create or replace function public.remove_member(p_user uuid) returns json
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  hid := public.ensure_household();
  if not exists (select 1 from public.household_members where household_id = hid and user_id = auth.uid() and role = 'owner') then
    return json_build_object('status', 'not_owner');
  end if;
  if p_user = auth.uid() then return json_build_object('status', 'self'); end if;
  delete from public.household_members where household_id = hid and user_id = p_user;
  return json_build_object('status', 'ok');
end $$;

-- Who's in the active household (emails only of people you share with).
create or replace function public.list_members() returns table (user_id uuid, email text, name text, role text, joined_at timestamptz, is_me boolean)
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  hid := public.ensure_household();
  return query
    select m.user_id, u.email::text, coalesce(u.raw_user_meta_data->>'name', '')::text, m.role, m.created_at, m.user_id = auth.uid()
    from public.household_members m join auth.users u on u.id = m.user_id
    where m.household_id = hid order by m.created_at;
end $$;

revoke all on function public.create_invite(), public.join_household(text), public.leave_household(), public.remove_member(uuid), public.list_members() from public, anon;
grant execute on function public.create_invite(), public.join_household(text), public.leave_household(), public.remove_member(uuid), public.list_members() to authenticated;

-- =====================================================================
-- v4 — Butler chat history and memory (additive only)
-- =====================================================================
-- Conversations are private to the person who had them.
create table if not exists public.butler_chats (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title        text not null default 'New chat',
  messages     jsonb not null default '[]'::jsonb,   -- what Butler sees (incl. tool calls)
  feed         jsonb not null default '[]'::jsonb,   -- what's shown in the chat
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists butler_chats_user_idx on public.butler_chats(user_id, updated_at desc);

-- Things Butler has learned. 'household' facts are shared with everyone in the household;
-- 'personal' ones are only ever visible to the person they came from.
create table if not exists public.butler_memories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scope        text not null default 'household' check (scope in ('household', 'personal')),
  fact         text not null check (length(fact) between 1 and 500),
  chat_id      uuid references public.butler_chats(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists butler_memories_household_idx on public.butler_memories(household_id);

do $$
declare t text;
begin
  foreach t in array array['butler_chats', 'butler_memories'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

alter table public.butler_chats    enable row level security;
alter table public.butler_memories enable row level security;

drop policy if exists butler_chats_own on public.butler_chats;
create policy butler_chats_own on public.butler_chats for all to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id))
  with check (user_id = auth.uid() and public.is_household_member(household_id));

drop policy if exists butler_memories_select on public.butler_memories;
create policy butler_memories_select on public.butler_memories for select to authenticated
  using (public.is_household_member(household_id) and (scope = 'household' or user_id = auth.uid()));
drop policy if exists butler_memories_insert on public.butler_memories;
create policy butler_memories_insert on public.butler_memories for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));
drop policy if exists butler_memories_change on public.butler_memories;
create policy butler_memories_change on public.butler_memories for update to authenticated
  using (public.is_household_member(household_id) and (scope = 'household' or user_id = auth.uid()))
  with check (public.is_household_member(household_id) and (scope = 'household' or user_id = auth.uid()));
drop policy if exists butler_memories_delete on public.butler_memories;
create policy butler_memories_delete on public.butler_memories for delete to authenticated
  using (public.is_household_member(household_id) and (scope = 'household' or user_id = auth.uid()));

grant select, insert, update, delete on public.butler_chats, public.butler_memories to authenticated;
revoke all on public.butler_chats, public.butler_memories from anon;
