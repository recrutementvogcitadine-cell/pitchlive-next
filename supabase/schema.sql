-- PITCH LIVE schema bootstrap
-- Run in Supabase SQL editor

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'seller', 'admin', 'viewer', 'agent', 'owner')),
  country text,
  moderation_status text not null default 'active' check (moderation_status in ('active', 'suspended', 'banned')),
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

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  enabled boolean not null default true,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create table if not exists public.sellers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  store_name text not null,
  whatsapp_number text not null,
  category text not null,
  country text not null,
  city text not null,
  identity_document_url text,
  selfie_document_url text,
  profile_photo_url text,
  seller_status text not null default 'pending_verification' check (seller_status in ('pending_verification', 'rejected', 'approved', 'active')),
  subscription_status text not null default 'unpaid' check (subscription_status in ('unpaid', 'pending_payment', 'paid', 'expired')),
  subscription_plan text check (subscription_plan in ('jour', 'semaine', 'mois')),
  subscription_expiry_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid,
  report_type text not null check (report_type in ('live_abusif', 'vendeur_frauduleux', 'contenu_interdit')),
  target_type text not null check (target_type in ('live', 'seller', 'user')),
  target_id text not null,
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_live_session on public.messages(live_session_id, created_at desc);
create index if not exists idx_likes_live_session on public.likes(live_session_id, created_at desc);
create index if not exists idx_gifts_live_session on public.gifts(live_session_id, created_at desc);
create index if not exists idx_presence_live_session on public.live_presence(live_session_id, joined_at desc);
create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id, enabled);
create index if not exists idx_sellers_status on public.sellers(seller_status, subscription_status);
create index if not exists idx_sellers_created_at on public.sellers(created_at desc);
create index if not exists idx_reports_created_at on public.reports(created_at desc);

alter table public.users enable row level security;
alter table public.live_sessions enable row level security;
alter table public.messages enable row level security;
alter table public.likes enable row level security;
alter table public.gifts enable row level security;
alter table public.followers enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.live_presence enable row level security;
alter table public.seller_store_profiles enable row level security;
alter table public.sellers enable row level security;
alter table public.reports enable row level security;

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

drop policy if exists push_subscriptions_all on public.push_subscriptions;
create policy push_subscriptions_all on public.push_subscriptions for all using (true) with check (true);

drop policy if exists presence_all on public.live_presence;
create policy presence_all on public.live_presence for all using (true) with check (true);

drop policy if exists seller_profiles_all on public.seller_store_profiles;
create policy seller_profiles_all on public.seller_store_profiles for all using (true) with check (true);

drop policy if exists sellers_select_own on public.sellers;
create policy sellers_select_own on public.sellers for select using (auth.uid() = user_id);

drop policy if exists sellers_insert_own on public.sellers;
create policy sellers_insert_own on public.sellers for insert with check (auth.uid() = user_id);

drop policy if exists sellers_update_own on public.sellers;
create policy sellers_update_own on public.sellers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists reports_all on public.reports;
create policy reports_all on public.reports for all using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

drop policy if exists kyc_insert_own on storage.objects;
create policy kyc_insert_own on storage.objects
for insert to authenticated
with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists kyc_select_own on storage.objects;
create policy kyc_select_own on storage.objects
for select to authenticated
using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists kyc_update_own on storage.objects;
create policy kyc_update_own on storage.objects
for update to authenticated
using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);
