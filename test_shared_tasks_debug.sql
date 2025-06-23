-- Debug Shared Tasks
-- This script will help check if there are any shared tasks in the database

-- Check if you're logged in
SELECT 
  '=== AUTHENTICATION CHECK ===' as info;
SELECT 
  'Current user ID:' as status,
  auth.uid() as user_id;

-- Check all shared tasks
SELECT 
  '=== ALL SHARED TASKS ===' as info;
SELECT 
  'Total shared tasks count:' as metric,
  COUNT(*) as count
FROM shared_tasks;

SELECT 
  'All shared tasks:' as details,
  id,
  original_task_id,
  shared_by,
  shared_with,
  status,
  created_at
FROM shared_tasks
ORDER BY created_at DESC
LIMIT 10;

-- Check shared tasks for current user
SELECT 
  '=== SHARED TASKS FOR CURRENT USER ===' as info;
SELECT 
  'Shared tasks for current user:' as metric,
  COUNT(*) as count
FROM shared_tasks 
WHERE shared_with = auth.uid() OR shared_by = auth.uid();

SELECT 
  'Current user shared tasks:' as details,
  id,
  original_task_id,
  shared_by,
  shared_with,
  status,
  created_at
FROM shared_tasks 
WHERE shared_with = auth.uid() OR shared_by = auth.uid()
ORDER BY created_at DESC;

-- Check if the original tasks exist
SELECT 
  '=== ORIGINAL TASKS CHECK ===' as info;
SELECT 
  'Original tasks that are shared:' as details,
  t.id,
  t.text,
  t.user_id,
  st.id as shared_task_id,
  st.shared_by,
  st.shared_with,
  st.status
FROM todos t
JOIN shared_tasks st ON t.id = st.original_task_id
WHERE st.shared_with = auth.uid() OR st.shared_by = auth.uid()
ORDER BY st.created_at DESC; 