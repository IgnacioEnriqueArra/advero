-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Table: screens
-- Represents a physical screen in a venue
create table public.screens (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references auth.users not null,
  name text not null,
  location text,
  slug text unique, -- For friendly URLs if needed
  status text check (status in ('active', 'inactive')) default 'active',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: media_uploads
-- Content uploaded by users to be shown on screens
create table public.media_uploads (
  id uuid primary key default uuid_generate_v4(),
  screen_id uuid references public.screens not null,
  user_id uuid references auth.users, -- Nullable for guest uploads if we allow that, or anon users
  file_url text not null,
  media_type text check (media_type in ('image', 'video')) not null,
  duration_seconds integer default 10,
  status text check (status in ('pending', 'paid', 'playing', 'played', 'rejected')) default 'pending',
  scheduled_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Table: transactions
-- Payment records
create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  media_upload_id uuid references public.media_uploads not null,
  amount numeric(10, 2) not null,
  currency text default 'USD',
  payment_provider_id text, -- Stripe PaymentIntent ID, etc.
  status text check (status in ('pending', 'succeeded', 'failed')) default 'pending',
  owner_commission numeric(10, 2) default 0,
  platform_commission numeric(10, 2) default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Row Level Security (RLS)

-- Screens: Anyone can view (if they have the link/QR), Owner can edit
alter table public.screens enable row level security;

create policy "Screens are viewable by everyone" 
  on public.screens for select 
  using (true);

create policy "Users can insert their own screens" 
  on public.screens for insert 
  with check (auth.uid() = owner_id);

create policy "Users can update their own screens" 
  on public.screens for update 
  using (auth.uid() = owner_id);

-- Media Uploads: Anyone can create (upload), Screen owner can view pending, Everyone can view playing (the screen)
alter table public.media_uploads enable row level security;

create policy "Anyone can upload media" 
  on public.media_uploads for insert 
  with check (true); 

create policy "Public can view media" 
  on public.media_uploads for select 
  using (true); 

-- Transactions: Only visible to the involved parties (simplified for now)
alter table public.transactions enable row level security;

create policy "Users can view their own transactions" 
  on public.transactions for select 
  using (auth.uid() = (select user_id from public.media_uploads where id = media_upload_id));

