-- =====================================================
-- TEST SHARED EVENTS FUNCTIONALITY
-- =====================================================
-- This script will test the shared events feature by:
-- 1. Creating a test user (if it doesn't exist)
-- 2. Finding your user account (@laughingstock)
-- 3. Creating a test event for the test user
-- 4. Creating a friendship between test user and you
-- 5. Sharing the event from test user to you
-- 6. Providing verification queries
-- =====================================================

-- Step 1: Find your user account (@laughingstock)
DO $$
DECLARE
    your_user_id UUID;
BEGIN
    -- Try to find your user by email (replace with your actual email)
    SELECT id INTO your_user_id 
    FROM auth.users 
    WHERE email LIKE '%laughingstock%' OR email LIKE '%@laughingstock%';
    
    -- If not found by email, try to find by username in profiles
    IF your_user_id IS NULL THEN
        SELECT p.id INTO your_user_id 
        FROM profiles p
        WHERE p.username = 'laughingstock' OR p.full_name LIKE '%laughingstock%';
    END IF;
    
    -- If still not found, you'll need to manually set your user ID
    IF your_user_id IS NULL THEN
        RAISE NOTICE 'Could not find your user account. Please manually set your user ID in the script.';
        RAISE NOTICE 'You can find your user ID by running: SELECT id, email FROM auth.users WHERE email LIKE ''%%your-email%%'';';
    ELSE
        RAISE NOTICE 'Found your user account with ID: %', your_user_id;
        PERFORM set_config('app.your_user_id', your_user_id::text, false);
    END IF;
END $$;

-- Step 2: Create a test user (if it doesn't exist)
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- Check if testuser exists
    SELECT id INTO test_user_id 
    FROM auth.users 
    WHERE email = 'testuser@example.com';
    
    -- Create testuser if it doesn't exist
    IF test_user_id IS NULL THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            recovery_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'testuser@example.com',
            crypt('password123', gen_salt('bf')),
            NOW(),
            NOW(),
            NOW(),
            '{"provider":"email","providers":["email"]}',
            '{"name":"Test User"}',
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        ) RETURNING id INTO test_user_id;
        
        -- Create profile for testuser
        INSERT INTO profiles (id, full_name, username, avatar_url, created_at, updated_at)
        VALUES (test_user_id, 'Test User', 'testuser', '', NOW(), NOW());
        
        RAISE NOTICE 'Created testuser with ID: %', test_user_id;
    ELSE
        RAISE NOTICE 'testuser already exists with ID: %', test_user_id;
    END IF;
    
    -- Store the test user ID for later use
    PERFORM set_config('app.test_user_id', test_user_id::text, false);
END $$;

-- Step 3: Get the user IDs
DO $$
DECLARE
    test_user_id UUID;
    your_user_id UUID;
BEGIN
    SELECT id INTO test_user_id FROM auth.users WHERE email = 'testuser@example.com';
    SELECT current_setting('app.your_user_id', true)::UUID INTO your_user_id;
    
    IF your_user_id IS NULL THEN
        RAISE EXCEPTION 'Your user ID not found. Please check the script and set your user ID manually.';
    END IF;
    
    RAISE NOTICE 'Test User ID: %', test_user_id;
    RAISE NOTICE 'Your User ID: %', your_user_id;
END $$;

-- Step 4: Create a test event for testuser
DO $$
DECLARE
    test_user_id UUID;
    test_event_id TEXT;
BEGIN
    SELECT id INTO test_user_id FROM auth.users WHERE email = 'testuser@example.com';
    
    -- Generate a TEXT ID for the event to match the shared_events table format
    test_event_id := 'event_' || EXTRACT(EPOCH FROM NOW())::TEXT || '_' || floor(random() * 1000000)::TEXT;
    
    -- Create a test event
    INSERT INTO events (
        id,
        user_id,
        title,
        description,
        location,
        date,
        start_datetime,
        end_datetime,
        category_name,
        category_color,
        is_all_day,
        created_at
    ) VALUES (
        test_event_id,
        test_user_id,
        'Test Event from Test User',
        'This is a test event shared from testuser to @laughingstock',
        'Test Location',
        '2025-01-15',
        '2025-01-15T10:00:00Z',
        '2025-01-15T11:00:00Z',
        'Test Category',
        '#FF6B6B',
        false,
        NOW()
    );
    
    -- Store the event ID for later use
    PERFORM set_config('app.test_event_id', test_event_id, false);
    
    RAISE NOTICE 'Created test event with ID: %', test_event_id;
END $$;

-- Step 5: Create friendship between testuser and you
DO $$
DECLARE
    test_user_id UUID;
    your_user_id UUID;
    friendship_id UUID;
BEGIN
    SELECT id INTO test_user_id FROM auth.users WHERE email = 'testuser@example.com';
    SELECT current_setting('app.your_user_id', true)::UUID INTO your_user_id;
    
    -- Check if friendship already exists
    SELECT id INTO friendship_id 
    FROM friendships 
    WHERE (user_id = test_user_id AND friend_id = your_user_id) 
       OR (user_id = your_user_id AND friend_id = test_user_id);
    
    IF friendship_id IS NULL THEN
        -- Create friendship
        INSERT INTO friendships (user_id, friend_id, status, created_at)
        VALUES (test_user_id, your_user_id, 'accepted', NOW())
        RETURNING id INTO friendship_id;
        
        RAISE NOTICE 'Created friendship with ID: %', friendship_id;
    ELSE
        RAISE NOTICE 'Friendship already exists with ID: %', friendship_id;
    END IF;
END $$;

-- Step 6: Share the event from testuser to you
DO $$
DECLARE
    test_user_id UUID;
    your_user_id UUID;
    test_event_id TEXT;
    shared_event_id UUID;
BEGIN
    SELECT id INTO test_user_id FROM auth.users WHERE email = 'testuser@example.com';
    SELECT current_setting('app.your_user_id', true)::UUID INTO your_user_id;
    SELECT current_setting('app.test_event_id', true) INTO test_event_id;
    
    -- Check if shared event already exists
    SELECT id INTO shared_event_id 
    FROM shared_events 
    WHERE original_event_id = test_event_id
      AND shared_by = test_user_id 
      AND shared_with = your_user_id;
    
    IF shared_event_id IS NULL THEN
        -- Share the event
        INSERT INTO shared_events (
            original_event_id,
            shared_by,
            shared_with,
            status,
            created_at,
            updated_at
        ) VALUES (
            test_event_id,
            test_user_id,
            your_user_id,
            'pending',
            NOW(),
            NOW()
        ) RETURNING id INTO shared_event_id;
        
        RAISE NOTICE 'Shared event with ID: %', shared_event_id;
    ELSE
        RAISE NOTICE 'Event already shared with ID: %', shared_event_id;
    END IF;
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Query 1: Check if test user exists
SELECT 
    id,
    email,
    created_at
FROM auth.users 
WHERE email = 'testuser@example.com';

-- Query 2: Find your user account
SELECT 
    id,
    email,
    created_at
FROM auth.users 
WHERE email LIKE '%laughingstock%' OR email LIKE '%@laughingstock%'
UNION
SELECT 
    u.id,
    u.email,
    u.created_at
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE p.username = 'laughingstock' OR p.full_name LIKE '%laughingstock%';

-- Query 3: Check if test event exists
SELECT 
    e.id,
    e.title,
    e.description,
    e.date,
    e.start_datetime,
    e.end_datetime,
    e.category_name,
    u.email as created_by
FROM events e
JOIN auth.users u ON e.user_id = u.id
WHERE e.title = 'Test Event from Test User'
ORDER BY e.created_at DESC;

-- Query 4: Check if friendship exists
SELECT 
    f.id,
    f.user_id,
    f.friend_id,
    f.status,
    f.created_at,
    u1.email as user_email,
    u2.email as friend_email
FROM friendships f
JOIN auth.users u1 ON f.user_id = u1.id
JOIN auth.users u2 ON f.friend_id = u2.id
WHERE u1.email = 'testuser@example.com' OR u2.email = 'testuser@example.com'
ORDER BY f.created_at DESC;

-- Query 5: Check if shared event exists
SELECT 
    se.id,
    se.original_event_id,
    se.shared_by,
    se.shared_with,
    se.status,
    se.created_at,
    e.title as event_title,
    u1.email as shared_by_email,
    u2.email as shared_with_email
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
JOIN auth.users u1 ON se.shared_by = u1.id
JOIN auth.users u2 ON se.shared_with = u2.id
WHERE e.title = 'Test Event from Test User'
ORDER BY se.created_at DESC;

-- Query 6: Test the friendship check function
SELECT 
    check_friendship(
        (SELECT id FROM auth.users WHERE email = 'testuser@example.com'),
        (SELECT current_setting('app.your_user_id', true)::UUID)
    ) as are_friends;

-- Query 7: Check what events are shared with you (this is what you should see in your app)
SELECT 
    'Events shared with you:' as info,
    se.id,
    se.original_event_id,
    se.shared_by,
    se.shared_with,
    se.status,
    e.title,
    e.description,
    e.date,
    e.start_datetime,
    e.end_datetime,
    e.category_name,
    e.category_color
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
WHERE se.shared_with = (SELECT current_setting('app.your_user_id', true)::UUID);

-- Query 8: Check what testuser has shared
SELECT 
    'Events shared by testuser:' as info,
    se.id,
    se.original_event_id,
    se.shared_by,
    se.shared_with,
    se.status,
    e.title,
    e.description,
    e.date,
    e.start_datetime,
    e.end_datetime
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
WHERE se.shared_by = (SELECT id FROM auth.users WHERE email = 'testuser@example.com');

-- Query 9: Debug - Check if the original event exists
SELECT 
    'Debug - Original Event Check:' as info,
    se.id as shared_event_id,
    se.original_event_id,
    se.shared_by,
    se.shared_with,
    se.status,
    CASE 
        WHEN e.id IS NOT NULL THEN 'EXISTS'
        ELSE 'MISSING'
    END as original_event_status,
    e.id as event_id,
    e.title as event_title,
    e.date as event_date
FROM shared_events se
LEFT JOIN events e ON se.original_event_id = e.id
WHERE se.shared_by = (SELECT id FROM auth.users WHERE email = 'testuser@example.com');

-- Query 10: Debug - Check all events for testuser
SELECT 
    'Debug - All Events for Test User:' as info,
    e.id,
    e.title,
    e.date,
    e.user_id,
    e.created_at
FROM events e
WHERE e.user_id = (SELECT id FROM auth.users WHERE email = 'testuser@example.com')
ORDER BY e.created_at DESC;

-- Query 11: Debug - Check all shared events
SELECT 
    'Debug - All Shared Events:' as info,
    se.id,
    se.original_event_id,
    se.shared_by,
    se.shared_with,
    se.status,
    se.created_at
FROM shared_events se
ORDER BY se.created_at DESC;

-- =====================================================
-- MANUAL USER ID SETUP (if automatic detection fails)
-- =====================================================

/*
-- If the automatic user detection doesn't work, you can manually set your user ID
-- Replace 'your-actual-user-id-here' with your real user ID

DO $$
BEGIN
    PERFORM set_config('app.your_user_id', 'your-actual-user-id-here', false);
    RAISE NOTICE 'Manually set your user ID to: %', current_setting('app.your_user_id');
END $$;

-- To find your user ID, run this query:
-- SELECT id, email, created_at FROM auth.users WHERE email LIKE '%your-email%';
*/

-- =====================================================
-- CLEANUP QUERIES (Run these to clean up test data)
-- =====================================================

/*
-- Uncomment these lines to clean up test data when done testing

-- Delete shared events
DELETE FROM shared_events 
WHERE original_event_id IN (
    SELECT id FROM events 
    WHERE title = 'Test Event from Test User'
);

-- Delete test events
DELETE FROM events 
WHERE title = 'Test Event from Test User';

-- Delete friendships with testuser
DELETE FROM friendships 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'testuser@example.com')
   OR friend_id = (SELECT id FROM auth.users WHERE email = 'testuser@example.com');

-- Delete testuser profile
DELETE FROM profiles 
WHERE id = (SELECT id FROM auth.users WHERE email = 'testuser@example.com');

-- Delete testuser
DELETE FROM auth.users 
WHERE email = 'testuser@example.com';

*/ 