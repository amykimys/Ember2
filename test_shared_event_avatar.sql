-- Comprehensive test script to fix avatar display in shared events
-- This script will add an avatar URL to a user profile and create a test shared event

DO $$
DECLARE
    test_user_id UUID := 'cf77e7d5-5743-46d5-add9-de9a1db64fd4'::UUID; -- Amy Kim's user ID
    test_event_id TEXT;
    test_shared_event_id UUID;
BEGIN
    RAISE NOTICE 'Starting avatar fix test...';
    
    -- Step 1: Add avatar URL to the user profile
    UPDATE profiles 
    SET avatar_url = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
    WHERE id = test_user_id;
    
    IF FOUND THEN
        RAISE NOTICE 'Avatar URL added to profile for user: %', test_user_id;
    ELSE
        RAISE NOTICE 'Profile not found for user: %', test_user_id;
    END IF;
    
    -- Step 2: Create a test event
    INSERT INTO events (
        id,
        title,
        description,
        date,
        start_datetime,
        end_datetime,
        user_id,
        category_name,
        is_all_day,
        created_at
    ) VALUES (
        'test-event-' || extract(epoch from now())::text,
        'Test Event for Avatar',
        'This is a test event to verify avatar display',
        '2025-01-20',
        '2025-01-20 10:00:00+00',
        '2025-01-20 11:00:00+00',
        test_user_id,
        'Test Category',
        false,
        now()
    ) RETURNING id INTO test_event_id;
    
    RAISE NOTICE 'Test event created with ID: %', test_event_id;
    
    -- Step 3: Create a shared event
    INSERT INTO shared_events (
        id,
        original_event_id,
        shared_by,
        shared_with,
        status,
        message,
        created_at
    ) VALUES (
        gen_random_uuid(),
        test_event_id,
        test_user_id,
        test_user_id, -- Sharing with self for testing
        'pending',
        'Test shared event to verify avatar display',
        now()
    ) RETURNING id INTO test_shared_event_id;
    
    RAISE NOTICE 'Test shared event created with ID: %', test_shared_event_id;
    
    -- Step 4: Verify the data
    RAISE NOTICE 'Verification:';
    RAISE NOTICE 'Profile avatar URL: %', (SELECT avatar_url FROM profiles WHERE id = test_user_id);
    RAISE NOTICE 'Test event exists: %', (SELECT COUNT(*) FROM events WHERE id = test_event_id);
    RAISE NOTICE 'Test shared event exists: %', (SELECT COUNT(*) FROM shared_events WHERE id = test_shared_event_id);
    
END $$; 