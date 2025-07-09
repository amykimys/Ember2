-- Fix profiles RLS to allow searching for users to send friend requests
-- This allows users to search for other users by name or username

-- Drop ALL existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own and friends' profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles of friend request senders" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles for friend requests" ON public.profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;

-- Create a new policy that allows users to view all profiles (for searching)
CREATE POLICY "Users can view all profiles for friend requests" ON public.profiles
FOR SELECT USING (true);

-- Create policies for other operations
CREATE POLICY "Users can create their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);

-- Test the search_users function
DO $$
DECLARE
  current_user_id uuid;
  search_results record;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to test the search functionality';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing search_users function...';
  RAISE NOTICE 'Current user: %', current_user_id;

  -- Test searching for users
  FOR search_results IN 
    SELECT * FROM search_users('test', current_user_id) LIMIT 5
  LOOP
    RAISE NOTICE 'Found user: % (%) - Friend: % - Status: %', 
      search_results.full_name, 
      search_results.username, 
      search_results.is_friend, 
      search_results.friendship_status;
  END LOOP;

  RAISE NOTICE 'Search test completed!';
END $$;

SELECT 'Profiles RLS policies fixed for friend requests!' as status; 