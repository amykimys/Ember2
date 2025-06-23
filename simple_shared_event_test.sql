-- Simple test script to send a shared event
-- Replace 'YOUR-USER-ID-HERE' with your actual user ID below

-- First, find your user ID by running this:
SELECT id, email FROM auth.users LIMIT 5;

-- Then replace the UUID below with your actual user ID
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    current_user_id UUID := 'YOUR-USER-ID-HERE'::UUID; -- Replace with your actual user ID
    test_event_id TEXT;
    test_shared_event_id UUID;
    unique_email TEXT;
BEGIN
    RAISE NOTICE 'Using user ID: %', current_user_id;
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
    
    -- Create test event
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
    
    RAISE NOTICE 'Successfully created shared event!';
    RAISE NOTICE 'Test event ID: %', test_event_id;
    RAISE NOTICE 'Shared event ID: %', test_shared_event_id;
    
END $$;

-- Verify the shared event was created
SELECT 
    se.id as shared_event_id,
    se.status,
    e.title,
    e.description,
    e.date,
    p.full_name as shared_by_name
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
JOIN profiles p ON se.shared_by = p.id
WHERE se.shared_with = 'YOUR-USER-ID-HERE'::UUID -- Replace with your actual user ID
AND se.status = 'pending'
ORDER BY se.created_at DESC
LIMIT 5; 