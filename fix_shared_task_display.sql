-- Fix Shared Task Display Issue
-- This script will help ensure shared tasks appear correctly for recipients

-- First, let's check the current state
SELECT 
  '=== CURRENT STATE CHECK ===' as info;

-- Check if there are any shared tasks without copied_task_id
SELECT 
  'Shared tasks without copied_task_id:' as issue,
  COUNT(*) as count
FROM shared_tasks 
WHERE copied_task_id IS NULL OR copied_task_id = '';

-- Check if there are any copied tasks that don't exist in todos table
SELECT 
  'Copied tasks that don\'t exist in todos:' as issue,
  COUNT(*) as count
FROM shared_tasks st
LEFT JOIN todos t ON st.copied_task_id = t.id
WHERE st.copied_task_id IS NOT NULL 
  AND st.copied_task_id != ''
  AND t.id IS NULL;

-- Check if there are any shared tasks with status issues
SELECT 
  'Shared tasks with non-accepted status:' as issue,
  status,
  COUNT(*) as count
FROM shared_tasks 
GROUP BY status;

-- Now let's fix potential issues

-- 1. Update any shared tasks that don't have a copied_task_id
-- This might happen if the sharing was done before the copied_task_id field was added
UPDATE shared_tasks 
SET copied_task_id = 'shared-' || extract(epoch from created_at)::text || '-' || floor(random() * 1000000)::text
WHERE copied_task_id IS NULL OR copied_task_id = '';

-- 2. Ensure all shared tasks have 'accepted' status
UPDATE shared_tasks 
SET status = 'accepted'
WHERE status IS NULL OR status = '';

-- 3. Create missing copied tasks if they don't exist
-- This is a more complex operation that should be done carefully
-- Let's first identify which copied tasks are missing
WITH missing_copied_tasks AS (
  SELECT 
    st.original_task_id,
    st.copied_task_id,
    st.shared_by,
    st.shared_with,
    st.created_at
  FROM shared_tasks st
  LEFT JOIN todos t ON st.copied_task_id = t.id
  WHERE st.copied_task_id IS NOT NULL 
    AND st.copied_task_id != ''
    AND t.id IS NULL
    AND st.status = 'accepted'
)
SELECT 
  'Missing copied tasks to create:' as info,
  COUNT(*) as count
FROM missing_copied_tasks;

-- 4. Let's also check if the share_task_with_friend function is working correctly
-- by looking at recent shared tasks
SELECT 
  '=== RECENT SHARED TASKS ANALYSIS ===' as info;

SELECT 
  'Recent shared tasks (last 10):' as details,
  id,
  original_task_id,
  copied_task_id,
  shared_by,
  shared_with,
  status,
  created_at,
  CASE 
    WHEN copied_task_id IS NULL OR copied_task_id = '' THEN 'MISSING_COPIED_ID'
    WHEN copied_task_id NOT LIKE 'shared-%' THEN 'INVALID_COPIED_ID_FORMAT'
    ELSE 'OK'
  END as copied_task_status
FROM shared_tasks 
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check if the todos table has the correct structure for copied tasks
SELECT 
  '=== COPIED TASKS IN TODOS TABLE ===' as info;

SELECT 
  'Copied tasks in todos table:' as details,
  COUNT(*) as count
FROM todos 
WHERE id LIKE 'shared-%';

SELECT 
  'Sample copied tasks:' as details,
  id,
  text,
  user_id,
  created_at
FROM todos 
WHERE id LIKE 'shared-%'
ORDER BY created_at DESC
LIMIT 5;

-- 6. Verify that the filtering logic would work correctly
-- This simulates what the app does
WITH user_shared_tasks AS (
  SELECT 
    original_task_id,
    copied_task_id,
    shared_by,
    shared_with,
    status
  FROM shared_tasks 
  WHERE status = 'accepted'
),
filtering_simulation AS (
  SELECT 
    ust.*,
    CASE 
      WHEN ust.shared_by = auth.uid() THEN ust.original_task_id
      WHEN ust.shared_with = auth.uid() THEN ust.copied_task_id
    END as task_id_to_show
  FROM user_shared_tasks ust
  WHERE ust.shared_by = auth.uid() OR ust.shared_with = auth.uid()
)
SELECT 
  '=== FILTERING SIMULATION ===' as info;

SELECT 
  'Tasks that should be shown for current user:' as details,
  fs.task_id_to_show,
  t.text,
  t.user_id,
  CASE 
    WHEN fs.shared_by = auth.uid() THEN 'SENDER'
    WHEN fs.shared_with = auth.uid() THEN 'RECIPIENT'
  END as user_role,
  CASE 
    WHEN t.id LIKE 'shared-%' THEN 'COPIED'
    ELSE 'ORIGINAL'
  END as task_type
FROM filtering_simulation fs
LEFT JOIN todos t ON fs.task_id_to_show = t.id
WHERE fs.task_id_to_show IS NOT NULL
ORDER BY t.created_at DESC; 