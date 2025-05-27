-- Create friendships table
create table if not exists public.friendships (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  friend_id uuid references auth.users(id) on delete cascade not null,
  status text check (status in ('pending', 'accepted')) not null default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Ensure a user can't be friends with themselves
  constraint no_self_friendship check (user_id != friend_id),
  -- Ensure unique friendship pairs
  constraint unique_friendship unique (user_id, friend_id)
);

-- Create indexes for better query performance
create index if not exists friendships_user_id_idx on public.friendships(user_id);
create index if not exists friendships_friend_id_idx on public.friendships(friend_id);
create index if not exists friendships_status_idx on public.friendships(status);

-- Enable Row Level Security (RLS)
alter table public.friendships enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can view their own friendships" on public.friendships;
drop policy if exists "Users can create friend requests" on public.friendships;
drop policy if exists "Users can update their own friend requests" on public.friendships;
drop policy if exists "Users can delete their own friendships" on public.friendships;

-- Create policies
create policy "Users can view their own friendships"
  on public.friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);

create policy "Users can create friend requests"
  on public.friendships for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own friend requests"
  on public.friendships for update
  using (auth.uid() = friend_id and status = 'pending')
  with check (status = 'accepted');

create policy "Users can delete their own friendships"
  on public.friendships for delete
  using (auth.uid() = user_id or auth.uid() = friend_id);

-- Create function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Drop existing trigger if it exists
drop trigger if exists set_updated_at on public.friendships;

-- Create trigger to automatically update updated_at
create trigger set_updated_at
  before update on public.friendships
  for each row
  execute function public.handle_updated_at(); 