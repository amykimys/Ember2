-- Simple Friends Feed Photo Sharing Test
-- This script works with your existing users and creates test photo shares

-- Step 1: Check your current users and friendships
SELECT 'Current users and friendships:' as info;
SELECT 
  u.id as user_id,
  u.email,
  p.full_name,
  p.username
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

SELECT 'Current friendships:' as info;
SELECT 
  f.id as friendship_id,
  f.user_id,
  f.friend_id,
  f.status,
  p1.full_name as user_name,
  p2.full_name as friend_name
FROM friendships f
JOIN profiles p1 ON f.user_id = p1.id
JOIN profiles p2 ON f.friend_id = p2.id
ORDER BY f.created_at DESC;

-- Step 2: Create test photo shares for existing users
-- Replace 'USER_ID_1' and 'USER_ID_2' with actual user IDs from your database
DO $$
DECLARE
    user1_id UUID := 'USER_ID_1'::UUID; -- Replace with actual user ID
    user2_id UUID := 'USER_ID_2'::UUID; -- Replace with actual user ID
    test_event_id TEXT := 'test-event-' || extract(epoch from now())::text;
    test_habit_id UUID := gen_random_uuid();
    event_photo_url TEXT := 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop';
    habit_photo_url TEXT := 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop';
    social_update_id UUID;
    has_updated_at BOOLEAN;
BEGIN
    -- Check if users exist
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user1_id) THEN
        RAISE EXCEPTION 'User 1 with ID % does not exist', user1_id;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = user2_id) THEN
        RAISE EXCEPTION 'User 2 with ID % does not exist', user2_id;
    END IF;
    
    -- Create friendship if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM friendships 
        WHERE (user_id = user1_id AND friend_id = user2_id) 
           OR (user_id = user2_id AND friend_id = user1_id)
    ) THEN
        INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
        VALUES (user1_id, user2_id, 'accepted', NOW(), NOW());
        RAISE NOTICE 'Created friendship between users';
    ELSE
        RAISE NOTICE 'Friendship already exists between users';
    END IF;
    
    -- Checks if updated_at column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND table_schema = 'public' 
        AND column_name = 'updated_at'
    ) INTO has_updated_at;
    
    -- Create an event for user2
    IF has_updated_at THEN
        INSERT INTO events (
            id,
            title,
            description,
            date,
            start_datetime,
            end_datetime,
            category_name,
            category_color,
            user_id,
            photos,
            created_at,
            updated_at
        ) VALUES (
            test_event_id,
            'Weekend Hiking Trip',
            'Going hiking at Mount Tamalpais this weekend. Beautiful views and great exercise!',
            '2024-01-15',
            '2024-01-15 09:00:00+00',
            '2024-01-15 17:00:00+00',
            'Outdoor',
            '#4CAF50',
            user2_id,
            ARRAY[event_photo_url],
            NOW(),
            NOW()
        );
    ELSE
        INSERT INTO events (
            id,
            title,
            description,
            date,
            start_datetime,
            end_datetime,
            category_name,
            category_color,
            user_id,
            photos,
            created_at
        ) VALUES (
            test_event_id,
            'Weekend Hiking Trip',
            'Going hiking at Mount Tamalpais this weekend. Beautiful views and great exercise!',
            '2024-01-15',
            '2024-01-15 09:00:00+00',
            '2024-01-15 17:00:00+00',
            'Outdoor',
            '#4CAF50',
            user2_id,
            ARRAY[event_photo_url],
            NOW()
        );
    END IF;
    
    RAISE NOTICE 'Created event for user2 with ID: %', test_event_id;
    
    -- Create a social update (photo share) for the event
    INSERT INTO social_updates (
        user_id,
        type,
        photo_url,
        caption,
        source_type,
        source_id,
        is_public,
        content,
        created_at
    ) VALUES (
        user2_id,
        'photo_share',
        event_photo_url,
        'Amazing views from our hiking trip today! 🏔️',
        'event',
        test_event_id,
        true,
        jsonb_build_object(
            'title', 'Weekend Hiking Trip',
            'photo_url', event_photo_url,
            'description', 'Going hiking at Mount Tamalpais this weekend. Beautiful views and great exercise!'
        ),
        NOW()
    ) RETURNING id INTO social_update_id;
    
    RAISE NOTICE 'Created event photo share with ID: %', social_update_id;
    
    -- Create a habit for user2
    INSERT INTO habits (
        id,
        text,
        description,
        user_id,
        category_id,
        require_photo,
        photos,
        created_at,
        updated_at
    ) VALUES (
        test_habit_id,
        'Daily Meditation',
        'Practice mindfulness meditation for 20 minutes each day',
        user2_id,
        NULL,
        true,
        jsonb_build_object('2024-01-15', habit_photo_url),
        NOW(),
        NOW()
    );
    
    -- Create a social update (photo share) for the habit
    INSERT INTO social_updates (
        user_id,
        type,
        photo_url,
        caption,
        source_type,
        source_id,
        is_public,
        content,
        created_at
    ) VALUES (
        user2_id,
        'photo_share',
        habit_photo_url,
        'Peaceful morning meditation session ☮️',
        'habit',
        test_habit_id,
        true,
        jsonb_build_object(
            'title', 'Daily Meditation',
            'photo_url', habit_photo_url,
            'description', 'Practice mindfulness meditation for 20 minutes each day'
        ),
        NOW()
    ) RETURNING id INTO social_update_id;
    
    RAISE NOTICE 'Created habit photo share with ID: %', social_update_id;
    
END $$;

-- Step 3: Test the friends feed function for user1
SELECT 'Friends feed for user1:' as info;
SELECT 
    update_id,
    user_name,
    user_username,
    photo_url,
    caption,
    source_type,
    source_title,
    created_at
FROM get_friends_photo_shares(
    'USER_ID_1'::UUID, -- Replace with actual user ID
    10
)
ORDER BY created_at DESC;

-- Step 4: Show all created social updates
SELECT 'All social updates created:' as info;
SELECT 
    su.id,
    su.user_id,
    p.full_name as user_name,
    su.type,
    su.photo_url,
    su.caption,
    su.source_type,
    su.source_id,
    su.is_public,
    su.created_at
FROM social_updates su
JOIN profiles p ON su.user_id = p.id
WHERE su.type = 'photo_share'
ORDER BY su.created_at DESC;

-- Step 5: Show the events and habits created
SELECT 'Events created:' as info;
SELECT 
    e.id,
    e.title,
    e.description,
    e.category_name,
    e.photos,
    p.full_name as user_name
FROM events e
JOIN profiles p ON e.user_id = p.id
WHERE e.id LIKE 'test-event-%';

SELECT 'Habits created:' as info;
SELECT 
    h.id,
    h.text,
    h.description,
    h.require_photo,
    h.photos,
    p.full_name as user_name
FROM habits h
JOIN profiles p ON h.user_id = p.id
WHERE h.text = 'Daily Meditation';

-- Step 6: Clean up test data (uncomment to remove)
-- DELETE FROM social_updates WHERE source_id LIKE 'test-event-%' OR source_id IN (
--     SELECT id FROM habits WHERE text = 'Daily Meditation'
-- );
-- DELETE FROM events WHERE id LIKE 'test-event-%';
-- DELETE FROM habits WHERE text = 'Daily Meditation'; 