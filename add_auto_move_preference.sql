-- Add auto_move_uncompleted_tasks column to user_preferences table
-- This script adds the missing column that's causing the PGRST204 error

-- Add the missing column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'auto_move_uncompleted_tasks'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN auto_move_uncompleted_tasks BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added auto_move_uncompleted_tasks column to user_preferences table';
  ELSE
    RAISE NOTICE 'auto_move_uncompleted_tasks column already exists in user_preferences table';
  END IF;
END $$;

-- Check the current structure of user_preferences table
SELECT 
  '=== USER_PREFERENCES TABLE STRUCTURE ===' as info;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences'
ORDER BY ordinal_position;

-- Show existing user preferences
SELECT 
  '=== EXISTING USER PREFERENCES ===' as info;

SELECT 
  user_id,
  default_screen,
  auto_move_uncompleted_tasks,
  created_at,
  updated_at
FROM user_preferences
LIMIT 10; 