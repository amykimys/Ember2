-- Debug Social Updates RLS and Insert Issues
-- Run this in your Supabase SQL Editor to diagnose why habit photos aren't being inserted

-- Step 1: Check current RLS status and policies
SELECT '=== CURRENT RLS STATUS ===' as info;
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'social_updates';

-- Step 2: Check existing RLS policies
SELECT '=== EXISTING RLS POLICIES ===' as info;
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'social_updates'
ORDER BY policyname;

-- Step 3: Check table structure and constraints
SELECT '=== TABLE STRUCTURE ===' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    ordinal_position
FROM information_schema.columns 
WHERE table_name = 'social_updates'
ORDER BY ordinal_position;

-- Step 4: Check constraints
SELECT '=== TABLE CONSTRAINTS ===' as info;
SELECT 
    conname,
    contype,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'social_updates'::regclass;

-- Step 5: Check current social updates (if any exist)
SELECT '=== CURRENT SOCIAL UPDATES ===' as info;
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
    p.full_name as user_name,
    p.username as user_username
FROM social_updates su
LEFT JOIN profiles p ON su.user_id = p.id
WHERE su.type = 'photo_share'
ORDER BY su.created_at DESC
LIMIT 10;

-- Step 6: Check if there are any habit photos in the database
SELECT '=== HABIT PHOTOS IN DATABASE ===' as info;
SELECT 
    h.id as habit_id,
    h.text as habit_name,
    h.user_id,
    h.photos,
    p.full_name as user_name
FROM habits h
LEFT JOIN profiles p ON h.user_id = p.id
WHERE h.photos IS NOT NULL 
    AND h.photos != '{}'::jsonb
    AND h.photos != 'null'::jsonb
ORDER BY h.updated_at DESC
LIMIT 10;

-- Step 7: Test the insert policy by attempting a test insert
SELECT '=== TESTING INSERT POLICY ===' as info;
DO $$
DECLARE
    current_user_id uuid;
    test_insert_id uuid;
    insert_result record;
BEGIN
    -- Get current user ID
    SELECT auth.uid() INTO current_user_id;
    
    IF current_user_id IS NULL THEN
        RAISE NOTICE 'No authenticated user found. Cannot test insert policy.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Testing insert with user ID: %', current_user_id;
    
    -- Try to insert a test photo share
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
        current_user_id,
        'photo_share',
        'https://test-photo-url.com/test.jpg',
        'Test habit photo share',
        'habit',
        gen_random_uuid(),
        true,
        jsonb_build_object('title', 'Test Habit', 'photo_url', 'https://test-photo-url.com/test.jpg')
    ) RETURNING id INTO test_insert_id;
    
    RAISE NOTICE '✓ Test insert successful! Inserted ID: %', test_insert_id;
    
    -- Clean up the test insert
    DELETE FROM social_updates WHERE id = test_insert_id;
    RAISE NOTICE '✓ Test insert cleaned up';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Test insert failed: %', SQLERRM;
    RAISE NOTICE 'Error code: %', SQLSTATE;
END $$;

-- Step 8: Check if the user has any habits that could be used for testing
SELECT '=== USER HABITS FOR TESTING ===' as info;
SELECT 
    h.id,
    h.text,
    h.user_id,
    h.photos,
    h.updated_at
FROM habits h
WHERE h.user_id = auth.uid()
ORDER BY h.updated_at DESC
LIMIT 5;

-- Step 9: Check if there are any recent errors in the logs
-- (Note: This requires access to Supabase logs which may not be available in SQL)
SELECT '=== RECENT ACTIVITY CHECK ===' as info;
SELECT 
    'Last 10 social updates created:' as activity_type,
    COUNT(*) as count
FROM social_updates 
WHERE created_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT 
    'Total photo shares in database:' as activity_type,
    COUNT(*) as count
FROM social_updates 
WHERE type = 'photo_share';

-- Step 10: Verify the friends feed function works
SELECT '=== TESTING FRIENDS FEED FUNCTION ===' as info;
SELECT 
    update_id,
    user_id,
    user_name,
    user_username,
    photo_url,
    source_type,
    source_title,
    created_at
FROM get_friends_photo_shares_with_privacy(
    COALESCE(auth.uid(), gen_random_uuid()),
    5
)
ORDER BY created_at DESC; 