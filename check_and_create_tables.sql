-- Check and Create Tables for Todo and Habits
-- This script checks if the required tables exist and creates them if they don't

-- 1. Check if todos table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'todos'
) as todos_table_exists;

-- 2. Check if habits table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'habits'
) as habits_table_exists;

-- 3. Create todos table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.todos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  date DATE NOT NULL,
  category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  repeat_type TEXT CHECK (repeat_type IN ('none', 'daily', 'weekly', 'monthly', 'custom')) DEFAULT 'none',
  repeat_end_date DATE,
  custom_repeat_dates TEXT[],
  reminder_time TIMESTAMP WITH TIME ZONE,
  photo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create habits table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.habits (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#A0C3B2',
  require_photo BOOLEAN DEFAULT FALSE,
  target_per_week INTEGER DEFAULT 7,
  reminder_time TIMESTAMP WITH TIME ZONE,
  repeat_type TEXT CHECK (repeat_type IN ('none', 'daily', 'weekly', 'monthly', 'custom')) DEFAULT 'daily',
  repeat_end_date DATE,
  completed_days TEXT[] DEFAULT '{}',
  notes JSONB DEFAULT '{}',
  photos JSONB DEFAULT '{}',
  category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Add indexes for better performance
CREATE INDEX IF NOT EXISTS todos_user_id_idx ON public.todos(user_id);
CREATE INDEX IF NOT EXISTS todos_date_idx ON public.todos(date);
CREATE INDEX IF NOT EXISTS todos_category_id_idx ON public.todos(category_id);

CREATE INDEX IF NOT EXISTS habits_user_id_idx ON public.habits(user_id);
CREATE INDEX IF NOT EXISTS habits_category_id_idx ON public.habits(category_id);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for todos
DROP POLICY IF EXISTS "Users can view their own todos" ON public.todos;
DROP POLICY IF EXISTS "Users can create their own todos" ON public.todos;
DROP POLICY IF EXISTS "Users can update their own todos" ON public.todos;
DROP POLICY IF EXISTS "Users can delete their own todos" ON public.todos;

CREATE POLICY "Users can view their own todos"
  ON public.todos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own todos"
  ON public.todos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own todos"
  ON public.todos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own todos"
  ON public.todos FOR DELETE
  USING (auth.uid() = user_id);

-- 8. Create RLS policies for habits
DROP POLICY IF EXISTS "Users can view their own habits" ON public.habits;
DROP POLICY IF EXISTS "Users can create their own habits" ON public.habits;
DROP POLICY IF EXISTS "Users can update their own habits" ON public.habits;
DROP POLICY IF EXISTS "Users can delete their own habits" ON public.habits;

CREATE POLICY "Users can view their own habits"
  ON public.habits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own habits"
  ON public.habits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own habits"
  ON public.habits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own habits"
  ON public.habits FOR DELETE
  USING (auth.uid() = user_id);

-- 9. Create updated_at triggers
CREATE OR REPLACE FUNCTION public.handle_todos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_habits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Create triggers
DROP TRIGGER IF EXISTS handle_todos_updated_at ON public.todos;
CREATE TRIGGER handle_todos_updated_at
  BEFORE UPDATE ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_todos_updated_at();

DROP TRIGGER IF EXISTS handle_habits_updated_at ON public.habits;
CREATE TRIGGER handle_habits_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_habits_updated_at();

-- 11. Verify tables were created
SELECT 
  table_name,
  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = table_name
  ) as table_exists
FROM (VALUES ('todos'), ('habits')) AS t(table_name);

-- 12. Show table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'todos'
ORDER BY ordinal_position;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'habits'
ORDER BY ordinal_position; 