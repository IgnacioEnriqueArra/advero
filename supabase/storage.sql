-- Create the 'media' bucket
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Set up security policies for the 'media' bucket
create policy "Media is publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'media' );

create policy "Anyone can upload media"
  on storage.objects for insert
  with check ( bucket_id = 'media' );

create policy "Anyone can update media"
  on storage.objects for update
  with check ( bucket_id = 'media' );
