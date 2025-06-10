-- Create friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  friend_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text CHECK (status IN ('pending', 'accepted', 'blocked')) DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- Ensure unique friendships (no duplicate friend relationships)
  UNIQUE(user_id, friend_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS friendships_user_id_idx ON public.friendships(user_id);
CREATE INDEX IF NOT EXISTS friendships_friend_id_idx ON public.friendships(friend_id);
CREATE INDEX IF NOT EXISTS friendships_status_idx ON public.friendships(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can create friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can update their own friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can delete their own friendships" ON public.friendships;

-- Create policies for friendships table
CREATE POLICY "Users can view their own friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friendships"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own friendships"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete their own friendships"
  ON public.friendships FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Create function to handle updated_at for friendships
CREATE OR REPLACE FUNCTION public.handle_friendships_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER handle_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_friendships_updated_at();

-- Create function to get user's friends
CREATE OR REPLACE FUNCTION public.get_user_friends(user_uuid uuid)
RETURNS TABLE (
  friend_id uuid,
  friend_name text,
  friend_avatar text,
  friend_username text,
  friendship_id uuid,
  status text,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN f.user_id = user_uuid THEN f.friend_id
      ELSE f.user_id
    END as friend_id,
    p.full_name as friend_name,
    p.avatar_url as friend_avatar,
    p.username as friend_username,
    f.id as friendship_id,
    f.status,
    f.created_at
  FROM public.friendships f
  JOIN public.profiles p ON (
    CASE 
      WHEN f.user_id = user_uuid THEN f.friend_id
      ELSE f.user_id
    END = p.id
  )
  WHERE (f.user_id = user_uuid OR f.friend_id = user_uuid)
    AND f.status = 'accepted';
END;
$$;

-- Create function to get pending friend requests
CREATE OR REPLACE FUNCTION public.get_pending_friend_requests(user_uuid uuid)
RETURNS TABLE (
  requester_id uuid,
  requester_name text,
  requester_avatar text,
  requester_username text,
  friendship_id uuid,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.user_id as requester_id,
    p.full_name as requester_name,
    p.avatar_url as requester_avatar,
    p.username as requester_username,
    f.id as friendship_id,
    f.created_at
  FROM public.friendships f
  JOIN public.profiles p ON f.user_id = p.id
  WHERE f.friend_id = user_uuid
    AND f.status = 'pending';
END;
$$;

-- Create function to search users by username or name
CREATE OR REPLACE FUNCTION public.search_users(search_term text, current_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  username text,
  is_friend boolean,
  friendship_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.full_name,
    p.avatar_url,
    p.username,
    CASE 
      WHEN f.id IS NOT NULL THEN true
      ELSE false
    END as is_friend,
    COALESCE(f.status, 'none') as friendship_status
  FROM public.profiles p
  LEFT JOIN public.friendships f ON (
    (f.user_id = current_user_id AND f.friend_id = p.id) OR
    (f.friend_id = current_user_id AND f.user_id = p.id)
  )
  WHERE p.id != current_user_id
    AND (
      LOWER(p.username) LIKE LOWER('%' || search_term || '%') OR
      LOWER(p.full_name) LIKE LOWER('%' || search_term || '%')
    )
  ORDER BY p.full_name;
END;
$$; 