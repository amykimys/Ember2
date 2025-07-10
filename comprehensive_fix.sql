-- Comprehensive fix for user_preferences table
-- This script fixes both the table structure and RLS policies
-- Run this in your Supabase Dashboard > SQL Editor

-- First, let's check what we're working with
SELECT 
  '=== CURRENT TABLE STATUS ===' as info;

SELECT 
  table_name,
  table_type,
  table_schema
FROM information_schema.tables 
WHERE table_name = 'user_preferences';

-- Check current table structure
SELECT 
  '=== CURRENT TABLE STRUCTURE ===' as info;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'user_preferences'
ORDER BY ordinal_position;

-- Check RLS status
SELECT 
  '=== RLS STATUS ===' as info;

SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'user_preferences';

-- Check existing policies
SELECT 
  '=== EXISTING POLICIES ===' as info;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_preferences';

-- Step 1: Backup existing data (if any)
CREATE TEMP TABLE user_preferences_backup AS 
SELECT * FROM user_preferences;

-- Step 2: Drop the table completely and recreate it
DROP TABLE IF EXISTS user_preferences CASCADE;

-- Step 3: Create the table with the correct structure
CREATE TABLE user_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  theme text CHECK (theme IN ('light', 'dark', 'system')) DEFAULT 'system',
  notifications_enabled boolean DEFAULT true,
  default_view text CHECK (default_view IN ('day', 'week', 'month')) DEFAULT 'day',
  email_notifications boolean DEFAULT true,
  push_notifications boolean DEFAULT true,
  default_screen text CHECK (default_screen IN ('calendar', 'todo', 'notes', 'profile')) DEFAULT 'calendar',
  auto_move_uncompleted_tasks boolean DEFAULT false,
  expo_push_token text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id)
);

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx ON user_preferences(user_id);

-- Step 5: Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Step 6: Create proper RLS policies
CREATE POLICY "Users can view their own preferences" ON user_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own preferences" ON user_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences" ON user_preferences
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own preferences" ON user_preferences
  FOR DELETE USING (user_id = auth.uid());

-- Step 7: Grant permissions
GRANT ALL ON user_preferences TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 8: Restore data from backup (if any)
INSERT INTO user_preferences 
SELECT * FROM user_preferences_backup;

-- Step 9: Drop the backup table
DROP TABLE user_preferences_backup;

-- Step 10: Show the final structure
SELECT 
  '=== FINAL TABLE STRUCTURE ===' as info;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'user_preferences'
ORDER BY ordinal_position;

-- Step 11: Show the final policies
SELECT 
  '=== FINAL POLICIES ===' as info;

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'user_preferences';

-- Step 12: Test the setup with a real user
DO $$
DECLARE
  test_user_id uuid := gen_random_uuid();
  test_pref_id uuid;
BEGIN
  RAISE NOTICE '🧪 Testing complete setup with user ID: %', test_user_id;
  
  -- Create a test user in auth.users
  BEGIN
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES (
      test_user_id,
      'test@example.com',
      crypt('testpass', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW()
    );
    RAISE NOTICE '✅ Test user created in auth.users';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Could not create test user in auth.users: %', SQLERRM;
  END;
  
  -- Test inserting a preference
  BEGIN
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
    
    RAISE NOTICE '✅ Test preference created with ID: %', test_pref_id;
    
    -- Test updating the preference
    UPDATE user_preferences 
    SET theme = 'dark', updated_at = NOW()
    WHERE id = test_pref_id;
    
    RAISE NOTICE '✅ Test preference updated successfully';
    
    -- Test selecting the preference
    PERFORM COUNT(*) FROM user_preferences WHERE id = test_pref_id;
    RAISE NOTICE '✅ Test preference can be selected';
    
    -- Clean up
    DELETE FROM user_preferences WHERE id = test_pref_id;
    RAISE NOTICE '✅ Test preference deleted successfully';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Error testing user preferences: %', SQLERRM;
  END;
  
  -- Clean up test user
  BEGIN
    DELETE FROM auth.users WHERE id = test_user_id;
    RAISE NOTICE '🧹 Test user cleaned up';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Could not clean up test user: %', SQLERRM;
  END;
  
END $$;

-- Step 13: Show existing data
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

-- Step 14: Final verification
SELECT 
  '=== FINAL VERIFICATION ===' as info;

SELECT 
  'Table exists' as check_item,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_preferences') 
       THEN '✅ PASS' ELSE '❌ FAIL' END as status
UNION ALL
SELECT 
  'RLS enabled' as check_item,
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_preferences' AND rowsecurity = true) 
       THEN '✅ PASS' ELSE '❌ FAIL' END as status
UNION ALL
SELECT 
  'Policies exist' as check_item,
  CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences') 
       THEN '✅ PASS' ELSE '❌ FAIL' END as status
UNION ALL
SELECT 
  'auto_move_uncompleted_tasks column exists' as check_item,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_preferences' AND column_name = 'auto_move_uncompleted_tasks') 
       THEN '✅ PASS' ELSE '❌ FAIL' END as status; 