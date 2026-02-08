-- Create Activity Logs Table for Audit Trail & Real-time Console
create table if not exists activity_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  type text not null check (type in ('INFO', 'WARNING', 'ERROR', 'REVENUE', 'SYSTEM', 'SECURITY')),
  event text not null, -- e.g., 'UPLOAD_COMPLETE', 'MEDIA_DELETED', 'SCREEN_REGISTERED'
  message text,
  metadata jsonb default '{}'::jsonb,
  owner_id uuid references auth.users(id), -- Optional: Link to owner if known
  screen_id uuid references screens(id) -- Optional: Link to screen
);

-- Enable RLS
alter table activity_logs enable row level security;

-- Policies
create policy "Owners can view their own logs"
  on activity_logs for select
  using (auth.uid() = owner_id);

create policy "Anyone can insert logs (for public uploaders)"
  on activity_logs for insert
  with check (true); -- Allow inserts from public upload page (or restrict via function)

-- Enable Realtime
alter publication supabase_realtime add table activity_logs;

-- Create Transactions Table (for robust financial records independent of media)
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  amount decimal(10,2) not null,
  currency text default 'USD',
  status text default 'completed',
  media_id uuid, -- Can be null if media is deleted, but we keep the transaction
  screen_id uuid references screens(id),
  payer_details jsonb
);

alter table transactions enable row level security;

create policy "Owners can view their transactions"
  on transactions for select
  using (
    exists (
      select 1 from screens
      where screens.id = transactions.screen_id
      and screens.owner_id = auth.uid()
    )
  );

create policy "Public can insert transactions"
  on transactions for insert
  with check (true);
