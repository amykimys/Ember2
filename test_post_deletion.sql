-- Test Post Deletion
-- This script tests the delete operation for social updates

-- First, let's create a test post
DO $$
DECLARE
    test_user_id UUID;
    test_post_id UUID;
BEGIN
    -- Get a test user
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE 'No users found in database';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Using test user ID: %', test_user_id;
    
    -- Create a test post
    INSERT INTO social_updates (
        user_id,
        type,
        photo_url,
        source_type,
        source_id,
        caption,
        is_public,
        content
    ) VALUES (
        test_user_id,
        'photo_share',
        'https://example.com/test-photo.jpg',
        'event',
        gen_random_uuid(),
        'Test post for deletion',
        true,
        jsonb_build_object(
            'title', 'Test Event',
            'photo_url', 'https://example.com/test-photo.jpg',
            'description', 'Test post for deletion'
        )
    ) RETURNING id INTO test_post_id;
    
    RAISE NOTICE 'Created test post with ID: %', test_post_id;
    
    -- Verify the post exists
    RAISE NOTICE 'Verifying post exists...';
    IF EXISTS (SELECT 1 FROM social_updates WHERE id = test_post_id) THEN
        RAISE NOTICE '✅ Post exists in database';
    ELSE
        RAISE NOTICE '❌ Post not found in database';
        RETURN;
    END IF;
    
    -- Test the delete operation
    RAISE NOTICE 'Testing delete operation...';
    DELETE FROM social_updates WHERE id = test_post_id;
    
    -- Check if deletion was successful
    IF NOT EXISTS (SELECT 1 FROM social_updates WHERE id = test_post_id) THEN
        RAISE NOTICE '✅ Post successfully deleted';
    ELSE
        RAISE NOTICE '❌ Post still exists after deletion attempt';
    END IF;
    
END $$;

-- Test the friends feed function with the current user
SELECT 'Testing friends feed function with current user:' as info;
SELECT 
    update_id,
    user_id,
    user_name,
    user_username,
    photo_url,
    source_type,
    created_at
FROM get_friends_photo_shares_with_privacy(
    auth.uid(), -- Current authenticated user
    10
)
ORDER BY created_at DESC;

-- Check if the current user can see their own posts
SELECT 'Current user can see their own posts:' as info;
SELECT 
    id,
    user_id,
    type,
    photo_url,
    source_type,
    created_at
FROM social_updates 
WHERE user_id = auth.uid() 
AND type = 'photo_share'
ORDER BY created_at DESC; 