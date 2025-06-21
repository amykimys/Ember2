-- Test Todo Fetching
-- This script helps test if todos are being fetched properly

-- 1. First, let's check your current user ID
-- Replace 'YOUR_EMAIL' with your actual email
SELECT 
  id,
  email,
  created_at
FROM auth.users 
WHERE email = 'YOUR_EMAIL'; -- Replace with your actual email

-- 2. Check if you have any todos
-- Replace 'YOUR_USER_ID' with the ID from step 1
SELECT 
  COUNT(*) as total_todos
FROM todos 
WHERE user_id = 'YOUR_USER_ID'::uuid; -- Replace with your actual user ID

-- 3. If no todos exist, let's create a test todo
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
  'Test Task',
  'This is a test task to verify the system works',
  false,
  CURRENT_DATE,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 4. Verify the test todo was created
SELECT 
  id,
  text,
  description,
  completed,
  date,
  created_at
FROM todos 
WHERE user_id = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
ORDER BY created_at DESC
LIMIT 5;

-- 5. Check if categories exist
SELECT 
  COUNT(*) as total_categories
FROM categories 
WHERE user_id = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND type = 'todo';

-- 6. If no categories exist, create a test category
INSERT INTO categories (
  id,
  user_id,
  label,
  color,
  type,
  created_at
) VALUES (
  gen_random_uuid(),
  'YOUR_USER_ID'::uuid, -- Replace with your actual user ID
  'Test Category',
  '#FF6B6B',
  'todo',
  NOW()
) ON CONFLICT DO NOTHING;

-- 7. Show all your data
SELECT 'TODOS' as table_name, COUNT(*) as count FROM todos WHERE user_id = 'YOUR_USER_ID'::uuid
UNION ALL
SELECT 'CATEGORIES' as table_name, COUNT(*) as count FROM categories WHERE user_id = 'YOUR_USER_ID'::uuid AND type = 'todo'
UNION ALL
SELECT 'HABITS' as table_name, COUNT(*) as count FROM habits WHERE user_id = 'YOUR_USER_ID'::uuid;

-- Cleanup (uncomment to remove test data)
/*
DELETE FROM todos 
WHERE user_id = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND text = 'Test Task';

DELETE FROM categories 
WHERE user_id = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND label = 'Test Category';
*/ 