-- Complete setup for shared tasks and habits functionality
-- Run this in the Supabase SQL Editor

-- Create shared_tasks table
CREATE TABLE IF NOT EXISTS public.shared_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_task_id TEXT NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  UNIQUE(original_task_id, shared_with)
);

-- Create shared_habits table
CREATE TABLE IF NOT EXISTS public.shared_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  UNIQUE(original_habit_id, shared_with)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS shared_tasks_shared_by_idx ON public.shared_tasks(shared_by);
CREATE INDEX IF NOT EXISTS shared_tasks_shared_with_idx ON public.shared_tasks(shared_with);
CREATE INDEX IF NOT EXISTS shared_tasks_status_idx ON public.shared_tasks(status);
CREATE INDEX IF NOT EXISTS shared_habits_shared_by_idx ON public.shared_habits(shared_by);
CREATE INDEX IF NOT EXISTS shared_habits_shared_with_idx ON public.shared_habits(shared_with);
CREATE INDEX IF NOT EXISTS shared_habits_status_idx ON public.shared_habits(status);

-- Add RLS policies for shared_tasks
ALTER TABLE public.shared_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shared tasks they created or were shared with"
  ON public.shared_tasks FOR SELECT
  USING (
    shared_by = auth.uid() OR shared_with = auth.uid()
  );

CREATE POLICY "Users can create shared tasks"
  ON public.shared_tasks FOR INSERT
  WITH CHECK (
    shared_by = auth.uid()
  );

CREATE POLICY "Users can update shared tasks they were shared with"
  ON public.shared_tasks FOR UPDATE
  USING (
    shared_with = auth.uid()
  );

CREATE POLICY "Users can delete shared tasks they created"
  ON public.shared_tasks FOR DELETE
  USING (
    shared_by = auth.uid()
  );

-- Add RLS policies for shared_habits
ALTER TABLE public.shared_habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shared habits they created or were shared with"
  ON public.shared_habits FOR SELECT
  USING (
    shared_by = auth.uid() OR shared_with = auth.uid()
  );

CREATE POLICY "Users can create shared habits"
  ON public.shared_habits FOR INSERT
  WITH CHECK (
    shared_by = auth.uid()
  );

CREATE POLICY "Users can update shared habits they were shared with"
  ON public.shared_habits FOR UPDATE
  USING (
    shared_with = auth.uid()
  );

CREATE POLICY "Users can delete shared habits they created"
  ON public.shared_habits FOR DELETE
  USING (
    shared_by = auth.uid()
  );

-- Create function to get shared tasks for a user
CREATE OR REPLACE FUNCTION public.get_shared_tasks_for_user(user_id uuid)
RETURNS TABLE (
  shared_task_id uuid,
  original_task_id text,
  task_text text,
  task_description text,
  task_completed boolean,
  task_date timestamp with time zone,
  shared_by_name text,
  shared_by_avatar text,
  shared_by_username text,
  shared_at timestamp with time zone,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    st.id as shared_task_id,
    st.original_task_id,
    t.text as task_text,
    t.description as task_description,
    t.completed as task_completed,
    t.date as task_date,
    p.full_name as shared_by_name,
    p.avatar_url as shared_by_avatar,
    p.username as shared_by_username,
    st.created_at as shared_at,
    st.status
  FROM public.shared_tasks st
  JOIN public.todos t ON st.original_task_id = t.id
  JOIN public.profiles p ON st.shared_by = p.id
  WHERE st.shared_with = user_id
    AND st.status = 'accepted'
  ORDER BY st.created_at DESC;
END;
$$;

-- Create function to get shared habits for a user
CREATE OR REPLACE FUNCTION public.get_shared_habits_for_user(user_id uuid)
RETURNS TABLE (
  shared_habit_id uuid,
  original_habit_id text,
  habit_text text,
  habit_description text,
  habit_completed_today boolean,
  habit_streak integer,
  shared_by_name text,
  shared_by_avatar text,
  shared_by_username text,
  shared_at timestamp with time zone,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sh.id as shared_habit_id,
    sh.original_habit_id,
    h.text as habit_text,
    h.description as habit_description,
    h.completed_today as habit_completed_today,
    h.streak as habit_streak,
    p.full_name as shared_by_name,
    p.avatar_url as shared_by_avatar,
    p.username as shared_by_username,
    sh.created_at as shared_at,
    sh.status
  FROM public.shared_habits sh
  JOIN public.habits h ON sh.original_habit_id = h.id
  JOIN public.profiles p ON sh.shared_by = p.id
  WHERE sh.shared_with = user_id
    AND sh.status = 'accepted'
  ORDER BY sh.created_at DESC;
END;
$$; 