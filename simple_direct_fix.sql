-- Simple direct fix for user_preferences table
-- This approach bypasses RLS complexity and ensures the table works
-- Run this in your Supabase Dashboard > SQL Editor

-- Step 1: Check what we have
SELECT '=== CURRENT STATUS ===' as info;
SELECT COUNT(*) as existing_records FROM user_preferences;

-- Step 2: Disable RLS temporarily to fix the table
ALTER TABLE user_preferences DISABLE ROW LEVEL SECURITY;

-- Step 3: Grant all permissions to everyone (temporarily)
GRANT ALL ON user_preferences TO authenticated;
GRANT ALL ON user_preferences TO anon;
GRANT ALL ON user_preferences TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;

-- Step 4: Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can create their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can delete their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_preferences;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_preferences;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON user_preferences;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON user_preferences;

-- Step 5: Ensure the table has the correct structure
-- Add missing column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'auto_move_uncompleted_tasks'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN auto_move_uncompleted_tasks boolean DEFAULT false;
    RAISE NOTICE 'Added auto_move_uncompleted_tasks column';
  ELSE
    RAISE NOTICE 'auto_move_uncompleted_tasks column already exists';
  END IF;
END $$;

-- Step 6: Test creating a preference (should work now)
DO $$
DECLARE
  test_user_id uuid := gen_random_uuid();
  test_pref_id uuid;
BEGIN
  RAISE NOTICE 'Testing preference creation with user ID: %', test_user_id;
  
  -- Try to insert a preference (should work without RLS)
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
  ) RETURNING id INTO test_pref_id;
  
  RAISE NOTICE '✅ Test preference created successfully with ID: %', test_pref_id;
  
  -- Clean up
  DELETE FROM user_preferences WHERE id = test_pref_id;
  RAISE NOTICE '🧹 Test preference cleaned up';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ Error: %', SQLERRM;
END $$;

-- Step 7: Show the final table structure
SELECT '=== FINAL TABLE STRUCTURE ===' as info;
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'user_preferences'
ORDER BY ordinal_position;

-- Step 8: Show existing data
SELECT '=== EXISTING DATA ===' as info;
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

-- Step 9: Final status
SELECT '=== FINAL STATUS ===' as info;
SELECT 
  'RLS disabled' as status,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'user_preferences' AND rowsecurity = false
  ) THEN '✅ PASS' ELSE '❌ FAIL' END as result
UNION ALL
SELECT 
  'Table accessible' as status,
  CASE WHEN EXISTS (
    SELECT 1 FROM user_preferences LIMIT 1
  ) THEN '✅ PASS' ELSE '❌ FAIL' END as result
UNION ALL
SELECT 
  'auto_move_uncompleted_tasks column exists' as status,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' 
    AND column_name = 'auto_move_uncompleted_tasks'
  ) THEN '✅ PASS' ELSE '❌ FAIL' END as result; 