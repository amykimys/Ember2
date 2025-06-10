-- Create profiles table
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  avatar_url text,
  bio text,
  timezone text,
  username text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create user_preferences table
create table if not exists public.user_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  theme text check (theme in ('light', 'dark', 'system')) default 'system',
  notifications_enabled boolean default true,
  default_view text check (default_view in ('day', 'week', 'month')) default 'day',
  email_notifications boolean default true,
  push_notifications boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- Ensure one preference record per user
  unique(user_id)
);

-- Add indexes for better performance
create index if not exists profiles_id_idx on public.profiles(id);
create index if not exists user_preferences_user_id_idx on public.user_preferences(user_id);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can create their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can delete their own profile" on public.profiles;

drop policy if exists "Users can view their own preferences" on public.user_preferences;
drop policy if exists "Users can create their own preferences" on public.user_preferences;
drop policy if exists "Users can update their own preferences" on public.user_preferences;
drop policy if exists "Users can delete their own preferences" on public.user_preferences;

-- Create policies for profiles table
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can delete their own profile"
  on public.profiles for delete
  using (auth.uid() = id);

-- Create policies for user_preferences table
create policy "Users can view their own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Users can create their own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id);

create policy "Users can delete their own preferences"
  on public.user_preferences for delete
  using (auth.uid() = user_id);

-- Create function to handle updated_at for profiles
create or replace function public.handle_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create function to handle updated_at for user_preferences
create or replace function public.handle_user_preferences_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Drop existing triggers if they exist
drop trigger if exists handle_profiles_updated_at on public.profiles;
drop trigger if exists handle_user_preferences_updated_at on public.user_preferences;

-- Create triggers for updated_at
create trigger handle_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.handle_profiles_updated_at();

create trigger handle_user_preferences_updated_at
  before update on public.user_preferences
  for each row
  execute function public.handle_user_preferences_updated_at();

-- Create function to handle user data deletion
create or replace function public.delete_user_data(user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Delete user's todos
  delete from public.todos where user_id = delete_user_data.user_id;
  
  -- Delete user's events
  delete from public.events where user_id = delete_user_data.user_id;
  
  -- Delete user's categories
  delete from public.categories where user_id = delete_user_data.user_id;
  
  -- Delete user's notes
  delete from public.notes where user_id = delete_user_data.user_id;
  
  -- Delete user's habits
  delete from public.habits where user_id = delete_user_data.user_id;
  
  -- Delete user's friendships
  delete from public.friendships where user_id = delete_user_data.user_id or friend_id = delete_user_data.user_id;
  
  -- Delete user's social updates
  delete from public.social_updates where user_id = delete_user_data.user_id;
  
  -- Delete user's preferences
  delete from public.user_preferences where user_id = delete_user_data.user_id;
  
  -- Delete user's profile
  delete from public.profiles where id = delete_user_data.user_id;
end;
$$;

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can view all avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- Set up storage policies for avatars (simplified)
CREATE POLICY "Users can upload avatars" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Users can view avatars" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can update avatars" ON storage.objects
FOR UPDATE USING (bucket_id = 'avatars');

CREATE POLICY "Users can delete avatars" ON storage.objects
FOR DELETE USING (bucket_id = 'avatars'); 