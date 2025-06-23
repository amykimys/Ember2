-- Test Friend Shared Task Scenario
-- This script simulates a friend sending you a shared task

-- 1. First, let's check your current user ID
-- Replace 'YOUR_EMAIL' with your actual email
SELECT 
  id as your_user_id,
  email,
  created_at
FROM auth.users 
WHERE email = 'YOUR_EMAIL'; -- Replace with your actual email

-- 2. Create a test friend user (if it doesn't exist)
-- This simulates another user who will share a task with you
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'testfriend@example.com') THEN
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      gen_random_uuid(),
      'testfriend@example.com',
      crypt('password123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false,
      '',
      '',
      '',
      ''
    );
  END IF;
END $$;

-- 3. Get the test friend's user ID
SELECT 
  id as friend_user_id,
  email as friend_email
FROM auth.users 
WHERE email = 'testfriend@example.com';

-- 4. Create a profile for the test friend
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT id FROM auth.users WHERE email = 'testfriend@example.com')) THEN
    INSERT INTO profiles (
      id,
      full_name,
      username,
      avatar_url,
      created_at,
      updated_at
    ) VALUES (
      (SELECT id FROM auth.users WHERE email = 'testfriend@example.com'),
      'Test Friend',
      'testfriend',
      '',
      NOW(),
      NOW()
    );
  END IF;
END $$;

-- 5. Create a friendship between you and the test friend
-- Replace 'YOUR_USER_ID' with your actual user ID from step 1
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM friendships 
    WHERE (user_id = 'YOUR_USER_ID'::uuid AND friend_id = (SELECT id FROM auth.users WHERE email = 'testfriend@example.com'))
    OR (user_id = (SELECT id FROM auth.users WHERE email = 'testfriend@example.com') AND friend_id = 'YOUR_USER_ID'::uuid)
  ) THEN
    INSERT INTO friendships (
      id,
      user_id,
      friend_id,
      status,
      created_at
    ) VALUES (
      gen_random_uuid(),
      'YOUR_USER_ID'::uuid, -- Replace with your actual user ID
      (SELECT id FROM auth.users WHERE email = 'testfriend@example.com'),
      'accepted',
      NOW()
    );
  END IF;
END $$;

-- 6. Create a test task for the friend
-- Replace 'FRIEND_USER_ID' with the friend's user ID from step 3
INSERT INTO todos (
  id,
  text,
  description,
  completed,
  category_id,
  date,
  repeat,
  repeat_end_date,
  reminder_time,
  custom_repeat_dates,
  user_id,
  created_at,
  updated_at
) VALUES (
  'friend-task-' || gen_random_uuid()::text,
  'Buy groceries for dinner',
  'Need to get ingredients for pasta dinner tonight',
  false,
  null,
  NOW() + INTERVAL '2 days',
  'none',
  null,
  null,
  null,
  (SELECT id FROM auth.users WHERE email = 'testfriend@example.com'),
  NOW(),
  NOW()
);

-- 7. Share the task with you
-- Replace 'YOUR_USER_ID' with your actual user ID from step 1
INSERT INTO shared_tasks (
  original_task_id,
  shared_by,
  shared_with,
  status,
  created_at,
  updated_at
) VALUES (
  (SELECT id FROM todos WHERE text = 'Buy groceries for dinner' AND user_id = (SELECT id FROM auth.users WHERE email = 'testfriend@example.com') ORDER BY created_at DESC LIMIT 1),
  (SELECT id FROM auth.users WHERE email = 'testfriend@example.com'),
  'YOUR_USER_ID'::uuid, -- Replace with your actual user ID
  'pending',
  NOW(),
  NOW()
);

-- 8. Verify the shared task was created
-- Replace 'YOUR_USER_ID' with your actual user ID from step 1
SELECT 
  st.id as shared_task_id,
  st.original_task_id,
  st.shared_by,
  st.shared_with,
  st.status,
  t.text as task_text,
  t.description as task_description,
  t.date as task_date,
  p.full_name as shared_by_name,
  p.avatar_url as shared_by_avatar,
  st.created_at as shared_at
FROM shared_tasks st
JOIN todos t ON st.original_task_id = t.id
JOIN profiles p ON st.shared_by = p.id
WHERE st.shared_with = 'YOUR_USER_ID'::uuid -- Replace with your actual user ID
  AND st.status = 'pending'
ORDER BY st.created_at DESC;

-- 9. Test the get_pending_shared_tasks function
-- Replace 'YOUR_USER_ID' with your actual user ID from step 1
SELECT * FROM get_pending_shared_tasks('YOUR_USER_ID'::uuid);

-- 10. Test accepting the shared task (uncomment to test)
/*
-- Replace 'SHARED_TASK_ID' with the shared_task_id from step 8
-- Replace 'YOUR_USER_ID' with your actual user ID from step 1
SELECT accept_shared_task(
  'SHARED_TASK_ID'::uuid,
  'YOUR_USER_ID'::uuid
);
*/

-- 11. Test declining the shared task (uncomment to test)
/*
-- Replace 'SHARED_TASK_ID' with the shared_task_id from step 8
-- Replace 'YOUR_USER_ID' with your actual user ID from step 1
SELECT decline_shared_task(
  'SHARED_TASK_ID'::uuid,
  'YOUR_USER_ID'::uuid
);
*/

-- 12. Clean up (optional - uncomment to remove test data)
/*
DELETE FROM shared_tasks WHERE original_task_id LIKE 'friend-task-%';
DELETE FROM todos WHERE id LIKE 'friend-task-%';
DELETE FROM friendships WHERE user_id = (SELECT id FROM auth.users WHERE email = 'testfriend@example.com');
DELETE FROM profiles WHERE id = (SELECT id FROM auth.users WHERE email = 'testfriend@example.com');
DELETE FROM auth.users WHERE email = 'testfriend@example.com';
*/ 