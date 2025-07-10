-- Fix RLS policies for user_preferences table
-- Run this in your Supabase Dashboard > SQL Editor

-- First, let's check the current RLS status and policies
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

-- Drop all existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can create their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can delete their own preferences" ON user_preferences;

-- Make sure RLS is enabled
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create proper RLS policies
CREATE POLICY "Users can view their own preferences" ON user_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own preferences" ON user_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences" ON user_preferences
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own preferences" ON user_preferences
  FOR DELETE USING (user_id = auth.uid());

-- Grant necessary permissions
GRANT ALL ON user_preferences TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Show the new policies
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

-- Test the policies with a mock user
DO $$
DECLARE
  test_user_id uuid := gen_random_uuid();
  test_pref_id uuid;
BEGIN
  RAISE NOTICE '🧪 Testing RLS policies with user ID: %', test_user_id;
  
  -- Create a test user in auth.users (if possible)
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
  END;
  
  -- Clean up test user
  BEGIN
    DELETE FROM auth.users WHERE id = test_user_id;
    RAISE NOTICE '🧹 Test user cleaned up';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Could not clean up test user: %', SQLERRM;
  END;
  
END $$;

-- Show existing user preferences
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