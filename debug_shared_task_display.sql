-- Debug Shared Task Display Issue
-- This script will help identify why shared tasks aren't appearing for recipients

-- Check if you're logged in
SELECT 
  '=== AUTHENTICATION CHECK ===' as info;
SELECT 
  'Current user ID:' as status,
  auth.uid() as user_id;

-- 1. Check all shared tasks
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
  copied_task_id,
  status,
  created_at
FROM shared_tasks
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check shared tasks for current user
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
  copied_task_id,
  status,
  created_at
FROM shared_tasks 
WHERE shared_with = auth.uid() OR shared_by = auth.uid()
ORDER BY created_at DESC;

-- 3. Check if copied tasks exist for current user
SELECT 
  '=== COPIED TASKS FOR CURRENT USER ===' as info;
SELECT 
  'Copied tasks count:' as metric,
  COUNT(*) as count
FROM todos 
WHERE user_id = auth.uid() 
  AND id LIKE 'shared-%';

SELECT 
  'Copied tasks:' as details,
  id,
  text,
  user_id,
  created_at
FROM todos 
WHERE user_id = auth.uid() 
  AND id LIKE 'shared-%'
ORDER BY created_at DESC;

-- 4. Check if original tasks exist
SELECT 
  '=== ORIGINAL TASKS THAT ARE SHARED ===' as info;
SELECT 
  'Original tasks that are shared:' as details,
  t.id,
  t.text,
  t.user_id,
  st.id as shared_task_id,
  st.shared_by,
  st.shared_with,
  st.copied_task_id,
  st.status
FROM todos t
JOIN shared_tasks st ON t.id = st.original_task_id
WHERE st.shared_with = auth.uid() OR st.shared_by = auth.uid()
ORDER BY st.created_at DESC;

-- 5. Check if there are any tasks that should be shown but aren't
SELECT 
  '=== TASKS THAT SHOULD BE SHOWN ===' as info;
WITH shared_task_info AS (
  SELECT 
    original_task_id,
    copied_task_id,
    shared_by,
    shared_with,
    status
  FROM shared_tasks 
  WHERE shared_with = auth.uid() OR shared_by = auth.uid()
),
tasks_to_show AS (
  SELECT DISTINCT
    CASE 
      WHEN shared_by = auth.uid() THEN original_task_id
      WHEN shared_with = auth.uid() THEN copied_task_id
    END as task_id_to_show
  FROM shared_task_info
  WHERE status = 'accepted'
)
SELECT 
  'Tasks that should be shown:' as details,
  tts.task_id_to_show,
  t.text,
  t.user_id,
  CASE 
    WHEN t.id LIKE 'shared-%' THEN 'COPIED'
    ELSE 'ORIGINAL'
  END as task_type
FROM tasks_to_show tts
LEFT JOIN todos t ON tts.task_id_to_show = t.id
WHERE tts.task_id_to_show IS NOT NULL
ORDER BY t.created_at DESC; 