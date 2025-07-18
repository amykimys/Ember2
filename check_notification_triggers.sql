-- Check if notification triggers are properly set up
-- This script will help verify the notification system status

-- 1. Check if the Edge Function exists
SELECT 
    'Edge Function Check' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'send-share-notification'
        ) THEN '✅ Edge Function exists'
        ELSE '❌ Edge Function not found'
    END as status;

-- 2. Check if shared_events table has notification trigger
SELECT 
    'Shared Events Trigger' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'shared_event_notification_trigger'
            AND event_object_table = 'shared_events'
        ) THEN '✅ Trigger exists'
        ELSE '❌ Trigger not found'
    END as status;

-- 3. Check if shared_tasks table has notification trigger
SELECT 
    'Shared Tasks Trigger' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'shared_task_notification_trigger'
            AND event_object_table = 'shared_tasks'
        ) THEN '✅ Trigger exists'
        ELSE '❌ Trigger not found'
    END as status;

-- 4. Check if shared_notes table has notification trigger
SELECT 
    'Shared Notes Trigger' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'shared_note_notification_trigger'
            AND event_object_table = 'shared_notes'
        ) THEN '✅ Trigger exists'
        ELSE '❌ Trigger not found'
    END as status;

-- 5. Check if pg_net extension is available
SELECT 
    'pg_net Extension' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'pg_net'
        ) THEN '✅ pg_net available'
        ELSE '❌ pg_net not available'
    END as status;

-- 6. Check if http extension is available
SELECT 
    'http Extension' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'http'
        ) THEN '✅ http available'
        ELSE '❌ http not available'
    END as status;

-- 7. List all triggers on shared tables
SELECT 
    'All Shared Table Triggers' as check_type,
    trigger_name,
    event_object_table,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table IN ('shared_events', 'shared_tasks', 'shared_notes')
ORDER BY event_object_table, trigger_name;

-- 8. Check recent shared items to see if triggers would fire
SELECT 
    'Recent Shared Events' as check_type,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM shared_events
WHERE created_at > NOW() - INTERVAL '7 days';

SELECT 
    'Recent Shared Tasks' as check_type,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM shared_tasks
WHERE created_at > NOW() - INTERVAL '7 days';

SELECT 
    'Recent Shared Notes' as check_type,
    COUNT(*) as count,
    MIN(created_at) as oldest,
    MAX(created_at) as newest
FROM shared_notes
WHERE created_at > NOW() - INTERVAL '7 days';

-- 9. Check if users have push tokens
SELECT 
    'Users with Push Tokens' as check_type,
    COUNT(*) as total_users,
    COUNT(expo_push_token) as users_with_tokens,
    COUNT(*) - COUNT(expo_push_token) as users_without_tokens
FROM profiles;

-- 10. Check notification preferences
SELECT 
    'Notification Preferences' as check_type,
    COUNT(*) as total_users,
    COUNT(CASE WHEN push_notifications = true THEN 1 END) as push_enabled,
    COUNT(CASE WHEN notifications_enabled = true THEN 1 END) as notifications_enabled
FROM user_preferences; 