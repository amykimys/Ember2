-- Create a function to get profiles by IDs (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_profiles_by_ids(profile_ids uuid[])
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  username text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    p.username
  FROM public.profiles p
  WHERE p.id = ANY(profile_ids);
END;
$$;

-- Test the function
SELECT * FROM public.get_profiles_by_ids(ARRAY['641a929a-6aec-4176-b7f8-bb1a50aa7dd3']::uuid[]); 