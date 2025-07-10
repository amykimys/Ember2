-- Test script to create a shared event with avatar
-- This will help us test if the avatar display works in shared events

DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    current_user_id UUID := 'cf77e7d5-5743-46d5-add9-de9a1db64fd4'::UUID; -- Amy Kim's user ID
    test_event_id TEXT;
    test_shared_event_id UUID;
    unique_email TEXT;
BEGIN
    RAISE NOTICE 'Using Amy Kim user ID: %', current_user_id;
    RAISE NOTICE 'Test user ID: %', test_user_id;
    
    -- Generate a unique email address
    unique_email := 'testfriend_' || extract(epoch from now())::text || '_' || floor(random() * 1000)::text || '@example.com';
    RAISE NOTICE 'Using unique email: %', unique_email;
    
    -- First, create the user in auth.users (required for foreign key constraint)
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
    )
    VALUES (
        test_user_id,
        unique_email,
        crypt('password123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{}',
        false,
        '',
        '',
        '',
        ''
    );
    
    RAISE NOTICE 'Created user in auth.users';
    
    -- Create test user profile WITH avatar URL
    INSERT INTO profiles (id, username, full_name, avatar_url, created_at, updated_at)
    VALUES (
        test_user_id,
        'testfriend',
        'Test Friend',
        'https://lh3.googleusercontent.com/a/ACg8ocKqQTMv-lB4ptM6O4B_TYwbA-9rp73GS5yH-LAoWeXjTmzbLQ=s96-c',
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Created test user profile with avatar URL';
    
    -- Create friendship
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
    
    -- Create test event for today
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
        created_at
    )
    VALUES (
        test_event_id,
        'Test Shared Event with Avatar',
        'This is a test event shared by Test Friend with avatar',
        'Test Location',
        '2025-01-09', -- Today's date
        '2025-01-09T10:00:00Z',
        '2025-01-09T11:00:00Z',
        'Test Category',
        '#FF6B6B',
        false,
        test_user_id,
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
    
    RAISE NOTICE 'Successfully created shared event with avatar!';
    RAISE NOTICE 'Test event ID: %', test_event_id;
    RAISE NOTICE 'Shared event ID: %', test_shared_event_id;
    RAISE NOTICE 'Test user ID: %', test_user_id;
    
END $$;

-- Verify the shared event was created
SELECT 
    'Verification - Shared Event Created:' as info,
    se.id as shared_event_id,
    se.status,
    e.title,
    e.description,
    e.date,
    p.full_name as shared_by_name,
    p.avatar_url as shared_by_avatar,
    CASE 
        WHEN p.avatar_url IS NULL THEN 'NULL'
        WHEN p.avatar_url = '' THEN 'EMPTY'
        WHEN p.avatar_url LIKE 'http%' THEN 'VALID_URL'
        ELSE 'INVALID_FORMAT'
    END as avatar_status
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
JOIN profiles p ON se.shared_by = p.id
WHERE se.shared_with = 'cf77e7d5-5743-46d5-add9-de9a1db64fd4'::UUID -- Amy Kim's user ID
AND se.status = 'pending'
ORDER BY se.created_at DESC
LIMIT 5; 