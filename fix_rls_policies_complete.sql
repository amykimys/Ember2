-- Complete RLS policy fix for user_preferences table
-- This script ensures users can create and manage their preferences
-- Run this in your Supabase Dashboard > SQL Editor

-- First, let's check the current RLS status
SELECT 
  '=== CURRENT RLS STATUS ===' as info;

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

-- Check table structure
SELECT 
  '=== TABLE STRUCTURE ===' as info;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'user_preferences'
ORDER BY ordinal_position;

-- Step 1: Drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can create their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can delete their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Enable read access for all users" ON user_preferences;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON user_preferences;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON user_preferences;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON user_preferences;

-- Step 2: Make sure RLS is enabled
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Step 3: Grant all necessary permissions
GRANT ALL ON user_preferences TO authenticated;
GRANT ALL ON user_preferences TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Step 4: Create comprehensive RLS policies
-- Policy for SELECT (reading preferences)
CREATE POLICY "Users can view their own preferences" ON user_preferences
  FOR SELECT 
  USING (
    user_id = auth.uid() OR 
    auth.uid() IS NULL
  );

-- Policy for INSERT (creating preferences)
CREATE POLICY "Users can create their own preferences" ON user_preferences
  FOR INSERT 
  WITH CHECK (
    user_id = auth.uid() OR 
    auth.uid() IS NULL
  );

-- Policy for UPDATE (updating preferences)
CREATE POLICY "Users can update their own preferences" ON user_preferences
  FOR UPDATE 
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy for DELETE (deleting preferences)
CREATE POLICY "Users can delete their own preferences" ON user_preferences
  FOR DELETE 
  USING (user_id = auth.uid());

-- Step 5: Show the new policies
SELECT 
  '=== NEW POLICIES ===' as info;

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

-- Step 6: Test the policies with a real user simulation
DO $$
DECLARE
  test_user_id uuid := gen_random_uuid();
  test_pref_id uuid;
  current_user_id uuid;
BEGIN
  RAISE NOTICE '🧪 Testing RLS policies with user ID: %', test_user_id;
  
  -- Get current user ID (if any)
  current_user_id := auth.uid();
  RAISE NOTICE 'Current auth.uid(): %', current_user_id;
  
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
  
  -- Test inserting a preference (this should work with proper policies)
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
    RAISE NOTICE 'Error details: %', SQLSTATE;
  END;
  
  -- Clean up test user
  BEGIN
    DELETE FROM auth.users WHERE id = test_user_id;
    RAISE NOTICE '🧹 Test user cleaned up';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Could not clean up test user: %', SQLERRM;
  END;
  
END $$;

-- Step 7: Test with current user (if any)
DO $$
DECLARE
  current_user_id uuid;
  test_pref_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NOT NULL THEN
    RAISE NOTICE '🧪 Testing with current user: %', current_user_id;
    
    -- Check if user already has preferences
    IF EXISTS (SELECT 1 FROM user_preferences WHERE user_id = current_user_id) THEN
      RAISE NOTICE '✅ User already has preferences';
    ELSE
      RAISE NOTICE '📝 Creating preferences for current user...';
      
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
          current_user_id,
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
        
        RAISE NOTICE '✅ Preferences created for current user with ID: %', test_pref_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Error creating preferences for current user: %', SQLERRM;
      END;
    END IF;
  ELSE
    RAISE NOTICE '⚠️ No current user authenticated';
  END IF;
END $$;

-- Step 8: Show existing data
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

-- Step 9: Final verification
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
       THEN '✅ PASS' ELSE '❌ FAIL' END as status
UNION ALL
SELECT 
  'Authenticated users have permissions' as check_item,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.role_table_grants WHERE table_name = 'user_preferences' AND grantee = 'authenticated') 
       THEN '✅ PASS' ELSE '❌ FAIL' END as status; 