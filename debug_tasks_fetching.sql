-- Debug Tasks/Todos Fetching Issues
-- This script helps identify why tasks are not showing up

-- 1. Check if todos table exists
SELECT 
  table_name,
  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = table_name
  ) as table_exists
FROM (VALUES ('todos'), ('tasks')) AS t(table_name);

-- 2. Check if you have any todos in the database
-- Replace 'YOUR_USER_ID' with your actual user ID
SELECT 
  COUNT(*) as total_todos,
  COUNT(CASE WHEN completed = true THEN 1 END) as completed_todos,
  COUNT(CASE WHEN completed = false THEN 1 END) as pending_todos
FROM todos 
WHERE user_id = 'YOUR_USER_ID'::uuid; -- Replace with your actual user ID

-- 3. Show all your todos with details
SELECT 
  id,
  text,
  description,
  completed,
  date,
  category_id,
  created_at,
  updated_at
FROM todos 
WHERE user_id = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
ORDER BY created_at DESC;

-- 4. Check if categories table exists and has data
SELECT 
  table_name,
  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = table_name
  ) as table_exists
FROM (VALUES ('categories')) AS t(table_name);

-- 5. Check your categories
SELECT 
  COUNT(*) as total_categories
FROM categories 
WHERE user_id = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND type = 'todo';

-- 6. Show your categories
SELECT 
  id,
  label,
  color,
  type,
  created_at
FROM categories 
WHERE user_id = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND type = 'todo'
ORDER BY created_at DESC;

-- 7. Check RLS policies on todos table
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

-- 8. Test if you can insert a test todo
-- This will help verify RLS policies are working
INSERT INTO todos (
  id,
  user_id,
  text,
  description,
  completed,
  date,
  created_at,
  updated_at
) VALUES (
  'test-todo-' || gen_random_uuid()::text,
  'YOUR_USER_ID'::uuid, -- Replace with your actual user ID
  'Test Todo',
  'This is a test todo to verify the system works',
  false,
  CURRENT_DATE,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 9. Check if the test todo was created
SELECT 
  id,
  text,
  description,
  completed,
  date,
  created_at
FROM todos 
WHERE user_id = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND text = 'Test Todo';

-- 10. Check if there are any todos with different user_id (data integrity check)
SELECT 
  user_id,
  COUNT(*) as todo_count
FROM todos 
GROUP BY user_id
ORDER BY todo_count DESC;

-- 11. Check if the todos table has the correct structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'todos'
ORDER BY ordinal_position;

-- 12. Check for any recent todos (last 7 days)
SELECT 
  id,
  text,
  description,
  completed,
  date,
  created_at
FROM todos 
WHERE user_id = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- Cleanup test data (uncomment to remove test todo)
/*
DELETE FROM todos 
WHERE user_id = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND text = 'Test Todo';
*/ 