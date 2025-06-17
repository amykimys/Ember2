-- Optimize notes table performance
-- Run this in your Supabase SQL editor

-- Add composite index for faster user-specific queries with ordering
CREATE INDEX IF NOT EXISTS notes_user_updated_idx ON public.notes(user_id, updated_at DESC);

-- Add index for title search (if you plan to add search functionality)
CREATE INDEX IF NOT EXISTS notes_title_gin_idx ON public.notes USING gin(to_tsvector('english', title));

-- Add index for content search (if you plan to add search functionality)
CREATE INDEX IF NOT EXISTS notes_content_gin_idx ON public.notes USING gin(to_tsvector('english', content));

-- Optimize the notes table by adding statistics
ANALYZE public.notes;

-- Create a function to get notes with pagination for better performance
CREATE OR REPLACE FUNCTION get_user_notes(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT n.id, n.title, n.content, n.user_id, n.created_at, n.updated_at
  FROM public.notes n
  WHERE n.user_id = p_user_id
  ORDER BY n.updated_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_notes(UUID, INTEGER, INTEGER) TO authenticated; 