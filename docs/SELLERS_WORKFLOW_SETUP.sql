-- Seller onboarding and KYC workflow for Pitch Live
-- Run this script in Supabase SQL editor.

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

create index if not exists idx_sellers_status on public.sellers(seller_status, subscription_status);
create index if not exists idx_sellers_created_at on public.sellers(created_at desc);

alter table public.sellers enable row level security;

-- Sellers can read/update only their own row.
drop policy if exists sellers_select_own on public.sellers;
create policy sellers_select_own on public.sellers
for select using (auth.uid() = user_id);

drop policy if exists sellers_insert_own on public.sellers;
create policy sellers_insert_own on public.sellers
for insert with check (auth.uid() = user_id);

drop policy if exists sellers_update_own on public.sellers;
create policy sellers_update_own on public.sellers
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private storage bucket for KYC docs.
insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

-- Authenticated users can upload/read only inside their own folder: {user_id}/...
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

-- Service role is used by secure admin API endpoints to review and sign URLs.
