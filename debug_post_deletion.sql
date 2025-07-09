-- Debug Post Deletion Issue
-- This script helps identify why posts can't be deleted from the friends feed

-- First, let's see what social updates exist
SELECT 'Current social updates:' as info;
SELECT 
    su.id,
    su.user_id,
    su.type,
    su.photo_url,
    su.source_type,
    su.source_id,
    su.caption,
    su.content,
    su.is_public,
    su.created_at,
    p.full_name as user_name,
    p.username as user_username
FROM social_updates su
LEFT JOIN profiles p ON su.user_id = p.id
WHERE su.type = 'photo_share'
ORDER BY su.created_at DESC;

-- Check the RLS policies on social_updates table
SELECT 'RLS Policies on social_updates:' as info;
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
WHERE tablename = 'social_updates';

-- Check if RLS is enabled
SELECT 'RLS Status:' as info;
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'social_updates';

-- Test the friends feed function
SELECT 'Testing friends feed function:' as info;
-- Replace 'YOUR_USER_ID' with an actual user ID from your database
SELECT 
    update_id,
    user_id,
    user_name,
    user_username,
    photo_url,
    source_type,
    created_at
FROM get_friends_photo_shares_with_privacy(
    (SELECT id FROM auth.users LIMIT 1), -- Replace with actual user ID
    10
)
ORDER BY created_at DESC;

-- Check if there are any constraint violations
SELECT 'Table constraints:' as info;
SELECT 
    conname,
    contype,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'social_updates'::regclass;

-- Check the actual table structure
SELECT 'Table structure:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'social_updates'
ORDER BY ordinal_position; 