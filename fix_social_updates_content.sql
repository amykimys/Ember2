-- Fix Social Updates Content Column
-- Make content column optional for photo_share type since it's not needed

-- First, let's check the current constraint
SELECT 'Current table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'social_updates'
ORDER BY ordinal_position;

-- Check current constraint
SELECT 'Current constraint:' as info;
SELECT 
    conname,
    contype,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'social_updates'::regclass;

-- Option 1: Make content column nullable for photo_share type
-- This is the simplest approach - just make content nullable
ALTER TABLE public.social_updates 
ALTER COLUMN content DROP NOT NULL;

-- Option 2: Create a check constraint that allows null content for photo_share
-- (Alternative approach - uncomment if you prefer this)
-- ALTER TABLE public.social_updates 
-- ADD CONSTRAINT social_updates_content_check 
-- CHECK (
--   (type = 'photo_share' AND content IS NULL) OR
--   (type != 'photo_share' AND content IS NOT NULL)
-- );

-- Verify the change
SELECT 'Updated table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'social_updates'
ORDER BY ordinal_position;

-- Test creating a photo share without content
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
    
    RAISE NOTICE 'Testing photo share creation without content...';
    
    -- Create a test post without content
    INSERT INTO social_updates (
        user_id,
        type,
        photo_url,
        source_type,
        source_id,
        caption,
        is_public
    ) VALUES (
        test_user_id,
        'photo_share',
        'https://example.com/test-photo-no-content.jpg',
        'event',
        gen_random_uuid(),
        'Test post without content',
        true
    ) RETURNING id INTO test_post_id;
    
    RAISE NOTICE '✅ Successfully created photo share without content, ID: %', test_post_id;
    
    -- Clean up
    DELETE FROM social_updates WHERE id = test_post_id;
    RAISE NOTICE '✅ Successfully deleted test post';
    
END $$;

-- Test creating a photo share with content (should still work)
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
    
    RAISE NOTICE 'Testing photo share creation with content...';
    
    -- Create a test post with content
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
        'https://example.com/test-photo-with-content.jpg',
        'event',
        gen_random_uuid(),
        'Test post with content',
        true,
        jsonb_build_object(
            'title', 'Test Event with Content',
            'photo_url', 'https://example.com/test-photo-with-content.jpg',
            'description', 'Test post with content'
        )
    ) RETURNING id INTO test_post_id;
    
    RAISE NOTICE '✅ Successfully created photo share with content, ID: %', test_post_id;
    
    -- Clean up
    DELETE FROM social_updates WHERE id = test_post_id;
    RAISE NOTICE '✅ Successfully deleted test post';
    
END $$; 