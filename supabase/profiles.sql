-- Create profiles table to store extra user information
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  venue_name text,
  location text,
  category text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies
alter table public.profiles enable row level security;

create policy "Users can view own profile" 
  on public.profiles for select 
  using (auth.uid() = id);

create policy "Users can update own profile" 
  on public.profiles for update 
  using (auth.uid() = id);

create policy "Users can insert own profile" 
  on public.profiles for insert 
  with check (auth.uid() = id);

-- Function to handle new user signup (optional, but good practice)
-- For now we will insert manually from the client to keep it simple with the form fields
