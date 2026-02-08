-- Allow ANYONE to DELETE/UPDATE media (Global Admin for Demo)
-- Use this ONLY for development/demo purposes to avoid permission issues

drop policy if exists "Screen owners can delete media" on public.media_uploads;
drop policy if exists "Screen owners can update media" on public.media_uploads;

create policy "Global Admin Delete" on public.media_uploads
for delete using (true);

create policy "Global Admin Update" on public.media_uploads
for update using (true);
