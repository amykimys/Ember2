-- Test Friends Feed Photo Sharing
-- This script simulates a friend attaching a photo to their event and shows up in your friends feed

-- Step 1: First, let's see what users exist in your database
SELECT 'Current users in database:' as info;
SELECT 
  u.id as user_id,
  u.email,
  p.full_name,
  p.username,
  u.created_at
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- Step 2: Create test users for the simulation
DO $$
DECLARE
    your_user_id UUID;
    friend_user_id UUID := gen_random_uuid();
    test_event_id TEXT := 'test-event-' || extract(epoch from now())::text;
    test_photo_url TEXT := 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop';
    social_update_id UUID;
BEGIN
    -- Get your user ID (replace with your actual email)
    SELECT id INTO your_user_id FROM auth.users WHERE email = 'your-email@example.com' LIMIT 1;
    
    -- If your user ID is not found, create a test user for you
    IF your_user_id IS NULL THEN
        your_user_id := gen_random_uuid();
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
        VALUES (
            your_user_id,
            'you@example.com',
            crypt('password123', gen_salt('bf')),
            NOW(),
            NOW(),
            NOW()
        );
        
        INSERT INTO profiles (id, full_name, username, avatar_url, created_at, updated_at)
        VALUES (
            your_user_id,
            'You',
            'you',
            'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created test user for you with ID: %', your_user_id;
    ELSE
        RAISE NOTICE 'Found your user ID: %', your_user_id;
    END IF;
    
    -- Create friend user
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES (
        friend_user_id,
        'friend@example.com',
        crypt('password123', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW()
    );
    
    INSERT INTO profiles (id, full_name, username, avatar_url, created_at, updated_at)
    VALUES (
        friend_user_id,
        'Sarah Johnson',
        'sarah',
        'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Created friend user with ID: %', friend_user_id;
    
    -- Create friendship between you and your friend
    INSERT INTO friendships (user_id, friend_id, status, created_at, updated_at)
    VALUES (
        your_user_id,
        friend_user_id,
        'accepted',
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Created friendship between you and Sarah';
    
    -- Create an event for your friend
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
        friend_user_id,
        ARRAY[test_photo_url],
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Created event for Sarah with ID: %', test_event_id;
    
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
        friend_user_id,
        'photo_share',
        test_photo_url,
        'Amazing views from our hiking trip today! 🏔️',
        'event',
        test_event_id,
        true,
        jsonb_build_object(
            'title', 'Weekend Hiking Trip',
            'photo_url', test_photo_url,
            'description', 'Going hiking at Mount Tamalpais this weekend. Beautiful views and great exercise!'
        ),
        NOW()
    ) RETURNING id INTO social_update_id;
    
    RAISE NOTICE 'Created social update (photo share) with ID: %', social_update_id;
    
    -- Test the friends feed function
    RAISE NOTICE 'Testing friends feed function...';
    
END $$;

-- Step 3: Test the friends feed function to see the photo share
SELECT 'Testing get_friends_photo_shares function:' as info;
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
    (SELECT id FROM auth.users WHERE email = 'you@example.com' LIMIT 1),
    10
);

-- Step 4: Show all social updates for verification
SELECT 'All social updates in database:' as info;
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
ORDER BY su.created_at DESC;

-- Step 5: Show the specific event that was created
SELECT 'Event created for photo sharing:' as info;
SELECT 
    e.id,
    e.title,
    e.description,
    e.date,
    e.category_name,
    e.category_color,
    e.photos,
    p.full_name as user_name,
    e.created_at
FROM events e
JOIN profiles p ON e.user_id = p.id
WHERE e.id LIKE 'test-event-%'
ORDER BY e.created_at DESC;

-- Step 6: Show friendship status
SELECT 'Friendship status:' as info;
SELECT 
    f.id as friendship_id,
    f.user_id,
    f.friend_id,
    f.status,
    p1.full_name as user_name,
    p2.full_name as friend_name,
    f.created_at
FROM friendships f
JOIN profiles p1 ON f.user_id = p1.id
JOIN profiles p2 ON f.friend_id = p2.id
WHERE (f.user_id = (SELECT id FROM auth.users WHERE email = 'you@example.com' LIMIT 1) 
   OR f.friend_id = (SELECT id FROM auth.users WHERE email = 'you@example.com' LIMIT 1))
ORDER BY f.created_at DESC;

-- Step 7: Clean up test data (uncomment to remove test data)
-- DELETE FROM social_updates WHERE user_id = (SELECT id FROM auth.users WHERE email = 'friend@example.com');
-- DELETE FROM events WHERE user_id = (SELECT id FROM auth.users WHERE email = 'friend@example.com');
-- DELETE FROM friendships WHERE user_id IN (
--     SELECT id FROM auth.users WHERE email IN ('you@example.com', 'friend@example.com')
-- ) OR friend_id IN (
--     SELECT id FROM auth.users WHERE email IN ('you@example.com', 'friend@example.com')
-- );
-- DELETE FROM profiles WHERE id IN (
--     SELECT id FROM auth.users WHERE email IN ('you@example.com', 'friend@example.com')
-- );
-- DELETE FROM auth.users WHERE email IN ('you@example.com', 'friend@example.com');

-- Step 8: Manual test - Create another photo share for a habit
DO $$
DECLARE
    friend_user_id UUID;
    test_habit_id UUID := gen_random_uuid();
    test_photo_url TEXT := 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop';
    social_update_id UUID;
BEGIN
    -- Get friend user ID
    SELECT id INTO friend_user_id FROM auth.users WHERE email = 'friend@example.com' LIMIT 1;
    
    IF friend_user_id IS NOT NULL THEN
        -- Create a habit for your friend
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
            friend_user_id,
            NULL,
            true,
            jsonb_build_object('2024-01-15', test_photo_url),
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
            friend_user_id,
            'photo_share',
            test_photo_url,
            'Peaceful morning meditation session ☮️',
            'habit',
            test_habit_id,
            true,
            jsonb_build_object(
                'title', 'Daily Meditation',
                'photo_url', test_photo_url,
                'description', 'Practice mindfulness meditation for 20 minutes each day'
            ),
            NOW()
        ) RETURNING id INTO social_update_id;
        
        RAISE NOTICE 'Created habit photo share with ID: %', social_update_id;
    END IF;
END $$;

-- Step 9: Test friends feed again to see both photo shares
SELECT 'Updated friends feed with both event and habit photo shares:' as info;
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
    (SELECT id FROM auth.users WHERE email = 'you@example.com' LIMIT 1),
    10
)
ORDER BY created_at DESC;

-- Step 10: Show the habit that was created
SELECT 'Habit created for photo sharing:' as info;
SELECT 
    h.id,
    h.text,
    h.description,
    h.require_photo,
    h.photos,
    p.full_name as user_name,
    h.created_at
FROM habits h
JOIN profiles p ON h.user_id = p.id
WHERE h.id = (
    SELECT id FROM habits 
    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'friend@example.com' LIMIT 1)
    AND text = 'Daily Meditation'
    LIMIT 1
); 