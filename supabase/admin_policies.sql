-- Enable moderation for Screen Owners
-- Allow owners to DELETE media uploads on their screens
create policy "Screen owners can delete media" on public.media_uploads
for delete using (
  exists (
    select 1 from public.screens
    where id = media_uploads.screen_id
    and owner_id = auth.uid()
  )
);

-- Allow owners to UPDATE media uploads on their screens (e.g., to reject/ban content)
create policy "Screen owners can update media" on public.media_uploads
for update using (
  exists (
    select 1 from public.screens
    where id = media_uploads.screen_id
    and owner_id = auth.uid()
  )
);
