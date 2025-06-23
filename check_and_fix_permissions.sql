-- Check and Fix Permissions for Shared Tasks
-- This script will diagnose and fix permission issues

-- Step 1: Check if you're logged in
SELECT 
  '=== STEP 1: AUTHENTICATION ===' as step;
SELECT 
  'Current user ID:' as info,
  auth.uid() as user_id;

-- Step 2: Check table permissions
SELECT 
  '=== STEP 2: TABLE PERMISSIONS ===' as step;

SELECT 
  'Todos table permissions:' as info,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'todos' 
  AND table_schema = 'public'
  AND grantee IN ('authenticated', 'anon');

SELECT 
  'Shared_tasks table permissions:' as info,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'shared_tasks' 
  AND table_schema = 'public'
  AND grantee IN ('authenticated', 'anon');

-- Step 3: Check RLS policies
SELECT 
  '=== STEP 3: RLS POLICIES ===' as step;

SELECT 
  'Todos RLS enabled:' as info,
  relname as table_name,
  relrowsecurity as rls_enabled
FROM pg_class 
WHERE relname = 'todos';

SELECT 
  'Shared_tasks RLS enabled:' as info,
  relname as table_name,
  relrowsecurity as rls_enabled
FROM pg_class 
WHERE relname = 'shared_tasks';

SELECT 
  'Todos RLS policies:' as info,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'todos';

SELECT 
  'Shared_tasks RLS policies:' as info,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'shared_tasks';

-- Step 4: Try to insert directly with error handling
DO $$
DECLARE
  current_user_id uuid;
  test_shared_task_id text := 'test-perm-' || extract(epoch from now())::text;
  test_original_task_id text := 'test-orig-' || extract(epoch from now())::text;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'ERROR: You are not logged in!';
    RETURN;
  END IF;

  RAISE NOTICE '=== STEP 4: TESTING DIRECT INSERT ===';
  RAISE NOTICE 'Current user: %', current_user_id;
  RAISE NOTICE 'Test shared task ID: %', test_shared_task_id;

  -- Try to insert into shared_tasks directly
  BEGIN
    INSERT INTO shared_tasks (
      original_task_id,
      shared_by,
      shared_with,
      status,
      created_at,
      updated_at
    ) VALUES (
      test_original_task_id,
      current_user_id,
      current_user_id,
      'accepted',
      NOW(),
      NOW()
    );
    RAISE NOTICE '✓ Direct insert into shared_tasks SUCCESSFUL';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Direct insert into shared_tasks FAILED: %', SQLERRM;
    RAISE NOTICE '✗ Error code: %', SQLSTATE;
  END;

  -- Check if the insert worked
  IF EXISTS (SELECT 1 FROM shared_tasks WHERE original_task_id = test_original_task_id) THEN
    RAISE NOTICE '✓ Shared task record exists in database';
  ELSE
    RAISE NOTICE '✗ Shared task record NOT found in database';
  END IF;

END $$;

-- Step 5: Fix permissions if needed
DO $$
BEGIN
  RAISE NOTICE '=== STEP 5: FIXING PERMISSIONS ===';
  
  -- Grant INSERT permission on shared_tasks to authenticated users
  BEGIN
    GRANT INSERT ON shared_tasks TO authenticated;
    RAISE NOTICE '✓ Granted INSERT permission on shared_tasks to authenticated';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Permission grant failed: %', SQLERRM;
  END;

  -- Grant SELECT permission on shared_tasks to authenticated users
  BEGIN
    GRANT SELECT ON shared_tasks TO authenticated;
    RAISE NOTICE '✓ Granted SELECT permission on shared_tasks to authenticated';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Permission grant failed: %', SQLERRM;
  END;

  -- Grant UPDATE permission on shared_tasks to authenticated users
  BEGIN
    GRANT UPDATE ON shared_tasks TO authenticated;
    RAISE NOTICE '✓ Granted UPDATE permission on shared_tasks to authenticated';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Permission grant failed: %', SQLERRM;
  END;

  -- Grant DELETE permission on shared_tasks to authenticated users
  BEGIN
    GRANT DELETE ON shared_tasks TO authenticated;
    RAISE NOTICE '✓ Granted DELETE permission on shared_tasks to authenticated';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Permission grant failed: %', SQLERRM;
  END;

END $$;

-- Step 6: Create RLS policy for shared_tasks if it doesn't exist
DO $$
BEGIN
  RAISE NOTICE '=== STEP 6: CREATING RLS POLICIES ===';
  
  -- Create policy for users to see shared tasks they're involved in
  BEGIN
    CREATE POLICY "Users can view shared tasks they're involved in" ON shared_tasks
      FOR SELECT USING (
        shared_by = auth.uid() OR shared_with = auth.uid()
      );
    RAISE NOTICE '✓ Created SELECT policy for shared_tasks';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SELECT policy creation failed: %', SQLERRM;
  END;

  -- Create policy for users to insert shared tasks
  BEGIN
    CREATE POLICY "Users can insert shared tasks" ON shared_tasks
      FOR INSERT WITH CHECK (
        shared_by = auth.uid()
      );
    RAISE NOTICE '✓ Created INSERT policy for shared_tasks';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'INSERT policy creation failed: %', SQLERRM;
  END;

  -- Create policy for users to update shared tasks they're involved in
  BEGIN
    CREATE POLICY "Users can update shared tasks they're involved in" ON shared_tasks
      FOR UPDATE USING (
        shared_by = auth.uid() OR shared_with = auth.uid()
      );
    RAISE NOTICE '✓ Created UPDATE policy for shared_tasks';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'UPDATE policy creation failed: %', SQLERRM;
  END;

  -- Create policy for users to delete shared tasks they created
  BEGIN
    CREATE POLICY "Users can delete shared tasks they created" ON shared_tasks
      FOR DELETE USING (
        shared_by = auth.uid()
      );
    RAISE NOTICE '✓ Created DELETE policy for shared_tasks';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'DELETE policy creation failed: %', SQLERRM;
  END;

END $$;

-- Step 7: Test insert again after fixing permissions
DO $$
DECLARE
  current_user_id uuid;
  test_shared_task_id text := 'test-fixed-' || extract(epoch from now())::text;
  test_original_task_id text := 'test-orig-fixed-' || extract(epoch from now())::text;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'ERROR: You are not logged in!';
    RETURN;
  END IF;

  RAISE NOTICE '=== STEP 7: TESTING INSERT AFTER FIXES ===';
  RAISE NOTICE 'Current user: %', current_user_id;

  -- Try to insert into shared_tasks again
  BEGIN
    INSERT INTO shared_tasks (
      original_task_id,
      shared_by,
      shared_with,
      status,
      created_at,
      updated_at
    ) VALUES (
      test_original_task_id,
      current_user_id,
      current_user_id,
      'accepted',
      NOW(),
      NOW()
    );
    RAISE NOTICE '✓ Insert into shared_tasks SUCCESSFUL after fixes';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Insert into shared_tasks STILL FAILED: %', SQLERRM;
    RAISE NOTICE '✗ Error code: %', SQLSTATE;
  END;

  -- Check if the insert worked
  IF EXISTS (SELECT 1 FROM shared_tasks WHERE original_task_id = test_original_task_id) THEN
    RAISE NOTICE '✓ Shared task record exists in database after fixes';
  ELSE
    RAISE NOTICE '✗ Shared task record STILL NOT found in database';
  END IF;

END $$;

-- Step 8: Show final results
SELECT 
  '=== STEP 8: FINAL RESULTS ===' as step;

SELECT 
  'Updated shared_tasks permissions:' as info,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants 
WHERE table_name = 'shared_tasks' 
  AND table_schema = 'public'
  AND grantee IN ('authenticated', 'anon');

SELECT 
  'Updated shared_tasks RLS policies:' as info,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'shared_tasks';

SELECT 
  'Test shared tasks created:' as details,
  id,
  original_task_id,
  shared_by,
  shared_with,
  status,
  created_at
FROM shared_tasks 
WHERE original_task_id LIKE 'test-%'
ORDER BY created_at DESC; 