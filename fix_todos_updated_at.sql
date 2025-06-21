-- Fix todos table missing updated_at column
-- This migration adds the missing updated_at column and sets up proper triggers

-- 1. Add updated_at column to todos table
ALTER TABLE todos 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 3. Create trigger to automatically update updated_at on row updates
DROP TRIGGER IF EXISTS update_todos_updated_at ON todos;
CREATE TRIGGER update_todos_updated_at
    BEFORE UPDATE ON todos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Update existing rows to have updated_at set to created_at
UPDATE todos 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- 5. Verify the changes
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'todos'
  AND column_name = 'updated_at';

-- 6. Check if trigger was created
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'todos'
  AND trigger_name = 'update_todos_updated_at'; 