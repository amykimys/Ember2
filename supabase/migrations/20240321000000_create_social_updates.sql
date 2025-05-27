-- Create social_updates table
create table if not exists public.social_updates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('goal_completion', 'journal_entry', 'streak_milestone')),
  content jsonb not null,
  is_public boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  metadata jsonb default '{}'::jsonb
);

-- Add indexes
create index if not exists social_updates_user_id_idx on public.social_updates(user_id);
create index if not exists social_updates_created_at_idx on public.social_updates(created_at);
create index if not exists social_updates_type_idx on public.social_updates(type);

-- Enable RLS
alter table public.social_updates enable row level security;

-- Create policies
drop policy if exists "Users can view their friends' public updates" on public.social_updates;
create policy "Users can view their friends' public updates"
  on public.social_updates for select
  using (
    exists (
      select 1 from public.friendships
      where (
        (user_id = auth.uid() and friend_id = social_updates.user_id) or
        (friend_id = auth.uid() and user_id = social_updates.user_id)
      )
      and status = 'accepted'
    )
    and is_public = true
  );

drop policy if exists "Users can create their own updates" on public.social_updates;
create policy "Users can create their own updates"
  on public.social_updates for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own updates" on public.social_updates;
create policy "Users can update their own updates"
  on public.social_updates for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own updates" on public.social_updates;
create policy "Users can delete their own updates"
  on public.social_updates for delete
  using (auth.uid() = user_id);

-- Create function to handle updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger for updated_at
drop trigger if exists handle_updated_at on public.social_updates;
create trigger handle_updated_at
  before update on public.social_updates
  for each row
  execute function public.handle_updated_at(); 