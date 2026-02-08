-- Enable Realtime for media_uploads table
-- This is required for the screen to receive updates instantly without refreshing.

-- Check if the publication exists, if not create it (Supabase usually has 'supabase_realtime')
-- However, we just need to add the table to it.

-- 1. Ensure the table is part of the publication
alter publication supabase_realtime add table public.media_uploads;

-- 2. Ensure the table has REPLICA IDENTITY FULL (optional but good for getting full row data on updates/deletes)
alter table public.media_uploads replica identity full;
