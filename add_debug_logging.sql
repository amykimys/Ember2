-- Add Debug Logging to Photo Sharing
-- This script adds debug logging to help identify why habit photos aren't being shared

-- Step 1: Create a debug logging function
CREATE OR REPLACE FUNCTION log_photo_sharing_debug(
    message TEXT,
    photo_data JSONB DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Insert debug log into a temporary table or use RAISE NOTICE
    RAISE NOTICE 'PHOTO_SHARING_DEBUG: % | Data: %', message, photo_data;
    
    -- You can also create a debug table if needed
    -- INSERT INTO debug_logs (message, data, created_at) VALUES (message, photo_data, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create a test function to simulate the photo sharing process
CREATE OR REPLACE FUNCTION test_habit_photo_sharing(
    test_user_id UUID,
    test_habit_id UUID,
    test_photo_url TEXT
) RETURNS TEXT AS $$
DECLARE
    test_insert_id UUID;
    habit_text TEXT;
BEGIN
    -- Log the test start
    PERFORM log_photo_sharing_debug('Starting test habit photo sharing', 
        jsonb_build_object(
            'user_id', test_user_id,
            'habit_id', test_habit_id,
            'photo_url', test_photo_url
        )
    );
    
    -- Get habit text
    SELECT text INTO habit_text FROM habits WHERE id = test_habit_id;
    
    -- Log habit found
    PERFORM log_photo_sharing_debug('Habit found', 
        jsonb_build_object('habit_text', habit_text)
    );
    
    -- Try to insert the social update
    INSERT INTO social_updates (
        user_id,
        type,
        photo_url,
        caption,
        source_type,
        source_id,
        is_public,
        content
    ) VALUES (
        test_user_id,
        'photo_share',
        test_photo_url,
        'Test habit photo share',
        'habit',
        test_habit_id,
        true,
        jsonb_build_object('title', habit_text, 'photo_url', test_photo_url)
    ) RETURNING id INTO test_insert_id;
    
    -- Log successful insert
    PERFORM log_photo_sharing_debug('Social update inserted successfully', 
        jsonb_build_object('inserted_id', test_insert_id)
    );
    
    -- Clean up the test insert
    DELETE FROM social_updates WHERE id = test_insert_id;
    
    -- Log cleanup
    PERFORM log_photo_sharing_debug('Test insert cleaned up');
    
    RETURN 'SUCCESS: Test completed successfully';
    
EXCEPTION WHEN OTHERS THEN
    -- Log the error
    PERFORM log_photo_sharing_debug('ERROR in test', 
        jsonb_build_object(
            'error_message', SQLERRM,
            'error_code', SQLSTATE
        )
    );
    
    RETURN 'ERROR: ' || SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Test the function with a real user and habit
SELECT '=== TESTING HABIT PHOTO SHARING ===' as info;
DO $$
DECLARE
    current_user_id UUID;
    test_habit_id UUID;
    test_result TEXT;
BEGIN
    -- Get current user ID
    SELECT auth.uid() INTO current_user_id;
    
    IF current_user_id IS NULL THEN
        RAISE NOTICE 'No authenticated user found. Cannot test.';
        RETURN;
    END IF;
    
    -- Get a habit for the current user
    SELECT id INTO test_habit_id 
    FROM habits 
    WHERE user_id = current_user_id 
    LIMIT 1;
    
    IF test_habit_id IS NULL THEN
        RAISE NOTICE 'No habits found for user. Cannot test.';
        RETURN;
    END IF;
    
    -- Test the photo sharing
    SELECT test_habit_photo_sharing(
        current_user_id,
        test_habit_id,
        'https://test-photo-url.com/test-habit.jpg'
    ) INTO test_result;
    
    RAISE NOTICE 'Test result: %', test_result;
END $$;

-- Step 4: Check if there are any constraint violations
SELECT '=== CHECKING FOR CONSTRAINT ISSUES ===' as info;
SELECT 
    'Content column constraint check:' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'social_updates' 
            AND column_name = 'content' 
            AND is_nullable = 'NO'
        ) THEN 'Content column is NOT NULL - this might cause issues for photo_share type'
        ELSE 'Content column allows NULL - this is good'
    END as result
UNION ALL
SELECT 
    'Type constraint check:' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'social_updates'::regclass 
            AND pg_get_constraintdef(oid) LIKE '%photo_share%'
        ) THEN 'photo_share type is allowed in constraints'
        ELSE 'photo_share type might not be allowed in constraints'
    END as result;

-- Step 5: Show recent social updates to see if any were created
SELECT '=== RECENT SOCIAL UPDATES ===' as info;
SELECT 
    su.id,
    su.user_id,
    su.type,
    su.photo_url,
    su.source_type,
    su.source_id,
    su.caption,
    su.is_public,
    su.created_at,
    p.full_name as user_name
FROM social_updates su
LEFT JOIN profiles p ON su.user_id = p.id
WHERE su.created_at > NOW() - INTERVAL '1 hour'
ORDER BY su.created_at DESC
LIMIT 10;

-- Step 6: Check if the user has any habits with photos
SELECT '=== USER HABITS WITH PHOTOS ===' as info;
SELECT 
    h.id,
    h.text,
    h.photos,
    h.updated_at,
    CASE 
        WHEN h.photos IS NULL THEN 'No photos'
        WHEN h.photos = '{}'::jsonb THEN 'Empty photos object'
        WHEN h.photos = 'null'::jsonb THEN 'Null photos'
        ELSE 'Has photos: ' || jsonb_array_length(h.photos) || ' entries'
    END as photo_status
FROM habits h
WHERE h.user_id = auth.uid()
ORDER BY h.updated_at DESC
LIMIT 10; 