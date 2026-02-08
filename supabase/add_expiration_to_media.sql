-- Add expires_at column to media_uploads if it doesn't exist
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name = 'media_uploads' and column_name = 'expires_at') then
    alter table public.media_uploads add column expires_at timestamp with time zone;
  end if;
end $$;

-- Update existing records to have an expiration (e.g., 24 hours from creation) so they don't disappear immediately if we switch logic
update public.media_uploads 
set expires_at = created_at + interval '1 day' 
where expires_at is null;
