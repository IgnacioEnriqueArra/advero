-- 1. Create the 'media' bucket (safe to run even if exists)
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- 2. Drop policies if they exist (to allow re-creation without error)
drop policy if exists "Media is publicly accessible" on storage.objects;
drop policy if exists "Anyone can upload media" on storage.objects;
drop policy if exists "Anyone can update media" on storage.objects;

-- 3. Create security policies for the 'media' bucket
create policy "Media is publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'media' );

create policy "Anyone can upload media"
  on storage.objects for insert
  with check ( bucket_id = 'media' );

create policy "Anyone can update media"
  on storage.objects for update
  with check ( bucket_id = 'media' );
