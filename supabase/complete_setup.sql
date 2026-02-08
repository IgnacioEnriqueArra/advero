-- Master Setup Script for AdVero
-- Run this entire script in the Supabase SQL Editor to set up the complete database schema.

-- ==========================================
-- 1. Base Tables (Screens, Media, Transactions)
-- ==========================================
create extension if not exists "uuid-ossp";

-- Table: screens
create table if not exists public.screens (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users not null,
  name text not null,
  location text,
  slug text unique,
  status text check (status in ('active', 'inactive')) default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: media_uploads
create table if not exists public.media_uploads (
  id uuid primary key default uuid_generate_v4(),
  screen_id uuid references public.screens not null,
  user_id uuid references auth.users,
  file_url text not null,
  media_type text check (media_type in ('image', 'video')) not null,
  duration_seconds integer default 10,
  status text check (status in ('pending', 'paid', 'playing', 'played', 'rejected')) default 'pending',
  scheduled_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: transactions
create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),
  media_upload_id uuid references public.media_uploads not null,
  amount numeric(10, 2) not null,
  currency text default 'USD',
  payment_provider_id text,
  status text check (status in ('pending', 'succeeded', 'failed')) default 'pending',
  owner_commission numeric(10, 2) default 0,
  platform_commission numeric(10, 2) default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 2. Profiles & Authentication Trigger
-- ==========================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  venue_name text,
  location text,
  category text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger 
language plpgsql 
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, venue_name, location, category)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'venue_name',
    new.raw_user_meta_data->>'location',
    new.raw_user_meta_data->>'category'
  );
  return new;
exception
  when others then
    raise warning 'Error in handle_new_user: %', SQLERRM;
    return new;
end;
$$;

-- Trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- 3. Row Level Security (RLS) & Policies
-- ==========================================
alter table public.screens enable row level security;
alter table public.media_uploads enable row level security;
alter table public.transactions enable row level security;
alter table public.profiles enable row level security;

-- Profiles Policies
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

drop policy if exists "Public can view profiles" on public.profiles;
create policy "Public can view profiles" on public.profiles for select using (true);

-- Screens Policies
drop policy if exists "Screens are viewable by everyone" on public.screens;
create policy "Screens are viewable by everyone" on public.screens for select using (true);

drop policy if exists "Users can insert their own screens" on public.screens;
create policy "Users can insert their own screens" on public.screens for insert with check (auth.uid() = owner_id);

drop policy if exists "Users can update their own screens" on public.screens;
create policy "Users can update their own screens" on public.screens for update using (auth.uid() = owner_id);

-- Media Uploads Policies
drop policy if exists "Anyone can upload media" on public.media_uploads;
create policy "Anyone can upload media" on public.media_uploads for insert with check (true);

drop policy if exists "Public can view media" on public.media_uploads;
create policy "Public can view media" on public.media_uploads for select using (true);

drop policy if exists "Public can update media" on public.media_uploads;
create policy "Public can update media" on public.media_uploads for update using (true);

-- ==========================================
-- 4. Storage Setup
-- ==========================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "Media is publicly accessible" on storage.objects;
create policy "Media is publicly accessible" on storage.objects for select using ( bucket_id = 'media' );

drop policy if exists "Anyone can upload media" on storage.objects;
create policy "Anyone can upload media" on storage.objects for insert with check ( bucket_id = 'media' );

drop policy if exists "Anyone can update media" on storage.objects;
create policy "Anyone can update media" on storage.objects for update with check ( bucket_id = 'media' );

-- ==========================================
-- 5. Data Fixes (for existing records)
-- ==========================================
-- Ensure any legacy data has an expiration date
update public.media_uploads 
set expires_at = now() + interval '7 days' 
where expires_at is null;

-- Grant permissions
grant all on public.media_uploads to anon;
grant all on public.media_uploads to authenticated;
grant all on public.media_uploads to service_role;
