-- Fix Upload Schema and Permissions
-- Run this script in Supabase SQL Editor to fix common upload errors

-- 1. Ensure media_uploads table exists with correct columns
create table if not exists public.media_uploads (
  id uuid primary key default uuid_generate_v4(),
  screen_id uuid references public.screens not null,
  user_id uuid references auth.users, -- Optional for anonymous uploads
  file_url text not null,
  media_type text check (media_type in ('image', 'video')) not null,
  duration_seconds integer default 10,
  status text check (status in ('pending', 'paid', 'playing', 'played', 'rejected')) default 'pending',
  scheduled_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Add missing columns if table already exists (Idempotent)
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name = 'media_uploads' and column_name = 'duration_seconds') then
    alter table public.media_uploads add column duration_seconds integer default 10;
  end if;
  
  if not exists (select 1 from information_schema.columns where table_name = 'media_uploads' and column_name = 'expires_at') then
    alter table public.media_uploads add column expires_at timestamp with time zone;
  end if;
end $$;

-- 3. Fix Row Level Security (RLS) Policies for Public Uploads
alter table public.media_uploads enable row level security;

-- Allow anyone (including anonymous) to insert
drop policy if exists "Anyone can upload media" on public.media_uploads;
create policy "Anyone can upload media" on public.media_uploads for insert with check (true);

-- Allow public to view media (needed for dashboard and select after insert)
drop policy if exists "Public can view media" on public.media_uploads;
create policy "Public can view media" on public.media_uploads for select using (true);

-- Allow public to update media (needed for payment simulation updates if any)
drop policy if exists "Public can update media" on public.media_uploads;
create policy "Public can update media" on public.media_uploads for update using (true);

-- 4. Grant permissions to anonymous role
grant all on public.media_uploads to anon;
grant all on public.media_uploads to authenticated;
grant all on public.media_uploads to service_role;

-- 5. Fix Storage Bucket Permissions
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;

drop policy if exists "Public Access" on storage.objects;
create policy "Public Access" on storage.objects for select using ( bucket_id = 'media' );

drop policy if exists "Public Upload" on storage.objects;
create policy "Public Upload" on storage.objects for insert with check ( bucket_id = 'media' );

