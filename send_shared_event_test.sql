-- Test script to send a shared event to the current user
-- This script creates a test user, friendship, original event, and shared event

-- Step 1: First, let's find your current user ID
-- Run this query first to get your user ID:
SELECT auth.uid() as current_user_id;

-- Step 2: If the above returns NULL, you need to manually specify your user ID
-- Replace 'YOUR-ACTUAL-USER-ID-HERE' with your real user ID from the auth.users table

-- Create a test user (friend) and send a shared event
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    current_user_id UUID;
    test_event_id TEXT;
    test_shared_event_id UUID;
BEGIN
    -- Try to get current user ID
    current_user_id := auth.uid();
    
    -- If no current user, you need to manually specify your user ID
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user found. Please run this query first to get your user ID: SELECT id FROM auth.users WHERE email = ''your-email@example.com''; Then replace the current_user_id assignment below with your actual user ID.';
    END IF;
    
    RAISE NOTICE 'Current user ID: %', current_user_id;
    RAISE NOTICE 'Test user ID: %', test_user_id;
    
    -- Create test user profile
    INSERT INTO profiles (id, username, full_name, avatar_url, created_at, updated_at)
    VALUES (
        test_user_id,
        'testfriend',
        'Test Friend',
        NULL,
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Created test user profile';
    
    -- Create friendship between test user and current user
    INSERT INTO friendships (id, user_id, friend_id, status, created_at, updated_at)
    VALUES (
        gen_random_uuid(),
        test_user_id,
        current_user_id,
        'accepted',
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Created friendship';
    
    -- Create a test event for the test user
    test_event_id := 'test_event_' || extract(epoch from now())::text || '_' || floor(random() * 1000)::text;
    
    INSERT INTO events (
        id,
        title,
        description,
        location,
        date,
        start_datetime,
        end_datetime,
        category_name,
        category_color,
        is_all_day,
        user_id,
        created_at,
        updated_at
    )
    VALUES (
        test_event_id,
        'Test Shared Event',
        'This is a test event shared by Test Friend',
        'Test Location',
        '2025-01-20',
        '2025-01-20T10:00:00Z',
        '2025-01-20T11:00:00Z',
        'Test Category',
        '#FF6B6B',
        false,
        test_user_id,
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Created test event with ID: %', test_event_id;
    
    -- Create shared event record
    test_shared_event_id := gen_random_uuid();
    
    INSERT INTO shared_events (
        id,
        original_event_id,
        shared_by,
        shared_with,
        status,
        created_at,
        updated_at
    )
    VALUES (
        test_shared_event_id,
        test_event_id,
        test_user_id,
        current_user_id,
        'pending',
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Created shared event record with ID: %', test_shared_event_id;
    
    -- Verify the data was created
    RAISE NOTICE 'Verification:';
    RAISE NOTICE 'Test user profile: %', (SELECT full_name FROM profiles WHERE id = test_user_id);
    RAISE NOTICE 'Friendship: %', (SELECT status FROM friendships WHERE user_id = test_user_id AND friend_id = current_user_id);
    RAISE NOTICE 'Original event: %', (SELECT title FROM events WHERE id = test_event_id);
    RAISE NOTICE 'Shared event: %', (SELECT status FROM shared_events WHERE id = test_shared_event_id);
    
END $$;

-- Step 3: Verify the shared event appears for the current user
SELECT 
    se.id as shared_event_id,
    se.status,
    e.title,
    e.description,
    e.date,
    e.start_datetime,
    e.end_datetime,
    p.full_name as shared_by_name,
    p.username as shared_by_username
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
JOIN profiles p ON se.shared_by = p.id
WHERE se.shared_with = auth.uid()
AND se.status = 'pending'
ORDER BY se.created_at DESC
LIMIT 5; 