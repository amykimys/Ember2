-- Simple fix for user_preferences table
-- Run this in your Supabase Dashboard > SQL Editor

-- First, let's see what columns currently exist
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences'
ORDER BY ordinal_position;

-- Add the missing column if it doesn't exist
DO $$
BEGIN
  -- Check if the column exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'auto_move_uncompleted_tasks'
  ) THEN
    -- Add the missing column
    ALTER TABLE user_preferences 
    ADD COLUMN auto_move_uncompleted_tasks boolean DEFAULT false;
    
    RAISE NOTICE '✅ Added auto_move_uncompleted_tasks column';
  ELSE
    RAISE NOTICE '✅ auto_move_uncompleted_tasks column already exists';
  END IF;
END $$;

-- Update any existing records to have the default value
UPDATE user_preferences 
SET auto_move_uncompleted_tasks = false 
WHERE auto_move_uncompleted_tasks IS NULL;

-- Show the final table structure
SELECT 
  '=== FINAL TABLE STRUCTURE ===' as info;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_preferences'
ORDER BY ordinal_position;

-- Test inserting a record
DO $$
DECLARE
  test_user_id uuid := gen_random_uuid();
  test_pref_id uuid;
BEGIN
  RAISE NOTICE '🧪 Testing user preference creation...';
  
  -- Create a test user
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    test_user_id,
    'test@example.com',
    crypt('testpass', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
  );
  
  -- Test inserting a preference
  INSERT INTO user_preferences (
    user_id,
    theme,
    notifications_enabled,
    default_view,
    email_notifications,
    push_notifications,
    default_screen,
    auto_move_uncompleted_tasks
  ) VALUES (
    test_user_id,
    'system',
    true,
    'day',
    true,
    true,
    'calendar',
    false
  ) RETURNING id INTO test_pref_id;
  
  RAISE NOTICE '✅ Test preference created successfully with ID: %', test_pref_id;
  
  -- Clean up
  DELETE FROM user_preferences WHERE id = test_pref_id;
  DELETE FROM auth.users WHERE id = test_user_id;
  RAISE NOTICE '🧹 Test data cleaned up';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Error: %', SQLERRM;
END $$;

-- Show existing data
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
  created_at,
  updated_at
FROM user_preferences
LIMIT 5; 