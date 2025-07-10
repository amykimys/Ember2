-- Comprehensive fix for user_preferences table
-- This script checks and adds all missing columns that might be causing the error

-- First, let's see the current table structure
SELECT 
  '=== CURRENT USER_PREFERENCES STRUCTURE ===' as info;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences'
ORDER BY ordinal_position;

-- Add all potentially missing columns
DO $$
BEGIN
  -- Add auto_move_uncompleted_tasks if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'auto_move_uncompleted_tasks'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN auto_move_uncompleted_tasks BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added auto_move_uncompleted_tasks column';
  ELSE
    RAISE NOTICE 'auto_move_uncompleted_tasks column already exists';
  END IF;

  -- Add default_screen if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'default_screen'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN default_screen TEXT DEFAULT 'calendar' CHECK (default_screen IN ('calendar', 'todo', 'notes', 'profile'));
    RAISE NOTICE 'Added default_screen column';
  ELSE
    RAISE NOTICE 'default_screen column already exists';
  END IF;

  -- Add expo_push_token if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'expo_push_token'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN expo_push_token TEXT;
    RAISE NOTICE 'Added expo_push_token column';
  ELSE
    RAISE NOTICE 'expo_push_token column already exists';
  END IF;

  -- Add any other missing columns that might be referenced
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'theme'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system'));
    RAISE NOTICE 'Added theme column';
  ELSE
    RAISE NOTICE 'theme column already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'notifications_enabled'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN notifications_enabled BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added notifications_enabled column';
  ELSE
    RAISE NOTICE 'notifications_enabled column already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'default_view'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN default_view TEXT DEFAULT 'day' CHECK (default_view IN ('day', 'week', 'month'));
    RAISE NOTICE 'Added default_view column';
  ELSE
    RAISE NOTICE 'default_view column already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'email_notifications'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN email_notifications BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added email_notifications column';
  ELSE
    RAISE NOTICE 'email_notifications column already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'push_notifications'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN push_notifications BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added push_notifications column';
  ELSE
    RAISE NOTICE 'push_notifications column already exists';
  END IF;

END $$;

-- Show the updated table structure
SELECT 
  '=== UPDATED USER_PREFERENCES STRUCTURE ===' as info;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences'
ORDER BY ordinal_position;

-- Check if there are any existing user preferences
SELECT 
  '=== EXISTING USER PREFERENCES ===' as info;

SELECT 
  user_id,
  theme,
  notifications_enabled,
  default_view,
  email_notifications,
  push_notifications,
  default_screen,
  auto_move_uncompleted_tasks,
  expo_push_token,
  created_at,
  updated_at
FROM user_preferences
LIMIT 10;

-- Test creating a user preference record
DO $$
DECLARE
  test_user_id uuid := gen_random_uuid();
BEGIN
  RAISE NOTICE 'Testing user preference creation with user ID: %', test_user_id;
  
  -- Try to insert a test record
  INSERT INTO user_preferences (
    user_id,
    theme,
    notifications_enabled,
    default_view,
    email_notifications,
    push_notifications,
    default_screen,
    auto_move_uncompleted_tasks,
    created_at,
    updated_at
  ) VALUES (
    test_user_id,
    'system',
    true,
    'day',
    true,
    true,
    'calendar',
    false,
    NOW(),
    NOW()
  );
  
  RAISE NOTICE '✅ Test user preference created successfully!';
  
  -- Clean up the test record
  DELETE FROM user_preferences WHERE user_id = test_user_id;
  RAISE NOTICE '🧹 Test record cleaned up';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Error creating test user preference: %', SQLERRM;
END $$; 