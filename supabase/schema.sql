-- PITCH LIVE schema bootstrap
-- Run in Supabase SQL editor

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  role text not null default 'viewer' check (role in ('viewer', 'agent', 'admin', 'owner')),
  created_at timestamptz not null default now()
);

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  creator_id text not null,
  channel_name text not null unique,
  title text not null,
  status text not null default 'live' check (status in ('live', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  likes_count int not null default 0,
  viewers_count int not null default 0
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id text not null,
  username text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id text not null,
  username text not null,
  gift_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.followers (
  creator_id text not null,
  follower_id text not null,
  created_at timestamptz not null default now(),
  primary key (creator_id, follower_id)
);

create table if not exists public.live_presence (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id text not null,
  joined_at timestamptz not null default now()
);

create table if not exists public.seller_store_profiles (
  seller_id text primary key,
  store_name text not null,
  tagline text not null,
  whatsapp_number text not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_messages_live_session on public.messages(live_session_id, created_at desc);
create index if not exists idx_likes_live_session on public.likes(live_session_id, created_at desc);
create index if not exists idx_gifts_live_session on public.gifts(live_session_id, created_at desc);
create index if not exists idx_presence_live_session on public.live_presence(live_session_id, joined_at desc);

alter table public.users enable row level security;
alter table public.live_sessions enable row level security;
alter table public.messages enable row level security;
alter table public.likes enable row level security;
alter table public.gifts enable row level security;
alter table public.followers enable row level security;
alter table public.live_presence enable row level security;
alter table public.seller_store_profiles enable row level security;

-- MVP open policies (tighten for production with auth checks)
drop policy if exists users_all on public.users;
create policy users_all on public.users for all using (true) with check (true);

drop policy if exists live_sessions_all on public.live_sessions;
create policy live_sessions_all on public.live_sessions for all using (true) with check (true);

drop policy if exists messages_all on public.messages;
create policy messages_all on public.messages for all using (true) with check (true);

drop policy if exists likes_all on public.likes;
create policy likes_all on public.likes for all using (true) with check (true);

drop policy if exists gifts_all on public.gifts;
create policy gifts_all on public.gifts for all using (true) with check (true);

drop policy if exists followers_all on public.followers;
create policy followers_all on public.followers for all using (true) with check (true);

drop policy if exists presence_all on public.live_presence;
create policy presence_all on public.live_presence for all using (true) with check (true);

drop policy if exists seller_profiles_all on public.seller_store_profiles;
create policy seller_profiles_all on public.seller_store_profiles for all using (true) with check (true);
