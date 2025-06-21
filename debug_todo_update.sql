-- Debug Todo Update Issue
-- This script helps identify why todo updates are failing

-- 1. Check the todos table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'todos'
ORDER BY ordinal_position;

-- 2. Check if there are any triggers on the todos table
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'todos';

-- 3. Check RLS policies on todos table
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
WHERE tablename = 'todos';

-- 4. Test a simple update (replace 'YOUR_USER_ID' with your actual user ID)
-- First, let's see what todos exist
SELECT 
  id,
  text,
  description,
  completed,
  date,
  created_at
FROM todos 
WHERE user_id = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
LIMIT 1;

-- 5. Try a minimal update to see if it works
-- Replace 'TASK_ID' with an actual task ID from step 4
UPDATE todos 
SET text = text || ' (test)'
WHERE id = 'TASK_ID' -- Replace with actual task ID
  AND user_id = 'YOUR_USER_ID'::uuid; -- Replace with your actual user ID

-- 6. Check if there are any functions that might be called on update
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_definition LIKE '%todos%'
  AND routine_definition LIKE '%updated_at%';

-- 7. Check for any foreign key constraints that might be causing issues
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'todos'; 