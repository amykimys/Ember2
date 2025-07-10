-- Refresh PostgREST schema cache and check for issues
-- This script will help resolve PGRST204 errors

-- First, let's check if the user_preferences table exists and its exact structure
SELECT 
  '=== TABLE EXISTENCE CHECK ===' as info;

SELECT 
  table_name,
  table_type,
  table_schema
FROM information_schema.tables 
WHERE table_name = 'user_preferences';

-- Check the exact column structure
SELECT 
  '=== EXACT COLUMN STRUCTURE ===' as info;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns 
WHERE table_name = 'user_preferences'
ORDER BY ordinal_position;

-- Check if there are any constraint issues
SELECT 
  '=== CONSTRAINT CHECK ===' as info;

SELECT 
  constraint_name,
  constraint_type,
  table_name
FROM information_schema.table_constraints 
WHERE table_name = 'user_preferences';

-- Check for any check constraints that might be causing issues
SELECT 
  '=== CHECK CONSTRAINTS ===' as info;

SELECT 
  cc.constraint_name,
  cc.check_clause
FROM information_schema.check_constraints cc
JOIN information_schema.table_constraints tc ON cc.constraint_name = tc.constraint_name
WHERE tc.table_name = 'user_preferences';

-- Try to refresh the schema cache by recreating the table structure
-- First, let's backup existing data
CREATE TEMP TABLE user_preferences_backup AS 
SELECT * FROM user_preferences;

-- Drop and recreate the table with the correct structure
DROP TABLE IF EXISTS user_preferences CASCADE;

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

-- Restore the data
INSERT INTO user_preferences 
SELECT * FROM user_preferences_backup;

-- Drop the backup table
DROP TABLE user_preferences_backup;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx ON user_preferences(user_id);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies
CREATE POLICY "Users can view their own preferences" ON user_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own preferences" ON user_preferences
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences" ON user_preferences
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own preferences" ON user_preferences
  FOR DELETE USING (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON user_preferences TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Show the final structure
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

-- Test creating a user preference
DO $$
DECLARE
  test_user_id uuid := gen_random_uuid();
  test_pref_id uuid;
BEGIN
  RAISE NOTICE 'Testing user preference creation...';
  
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