-- Setup Notifications with Edge Functions (No pg_net)
-- This script sets up the notification system using Supabase Edge Functions

-- 1. Create notification_logs table for tracking notifications
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expo_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add RLS policies for notification_logs
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notification logs
DROP POLICY IF EXISTS "Users can view their own notification logs" ON notification_logs;
CREATE POLICY "Users can view their own notification logs" ON notification_logs
  FOR SELECT USING (auth.uid() = recipient_id OR auth.uid() = sender_id);

-- Service role can insert notification logs
DROP POLICY IF EXISTS "Service role can insert notification logs" ON notification_logs;
CREATE POLICY "Service role can insert notification logs" ON notification_logs
  FOR INSERT WITH CHECK (true);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_logs_recipient_id ON notification_logs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sender_id ON notification_logs(sender_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);

-- 4. Add push_notifications_enabled column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'push_notifications_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN push_notifications_enabled BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added push_notifications_enabled column to profiles table';
  END IF;
END $$;

-- 5. Create a function to get notification statistics
DROP FUNCTION IF EXISTS get_notification_stats(UUID, INTEGER);
CREATE OR REPLACE FUNCTION get_notification_stats(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  total_sent INTEGER,
  total_received INTEGER,
  tasks_shared INTEGER,
  events_shared INTEGER,
  notes_shared INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE sender_id = p_user_id) as total_sent,
    COUNT(*) FILTER (WHERE recipient_id = p_user_id) as total_received,
    COUNT(*) FILTER (WHERE sender_id = p_user_id AND item_type = 'task') as tasks_shared,
    COUNT(*) FILTER (WHERE sender_id = p_user_id AND item_type = 'event') as events_shared,
    COUNT(*) FILTER (WHERE sender_id = p_user_id AND item_type = 'note') as notes_shared
  FROM notification_logs
  WHERE (sender_id = p_user_id OR recipient_id = p_user_id)
    AND sent_at >= NOW() - INTERVAL '1 day' * p_days;
END;
$$;

GRANT EXECUTE ON FUNCTION get_notification_stats TO authenticated;

-- 6. Create a function to get recent notifications for a user
DROP FUNCTION IF EXISTS get_recent_notifications(UUID, INTEGER);
CREATE OR REPLACE FUNCTION get_recent_notifications(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  id UUID,
  type TEXT,
  item_id TEXT,
  item_type TEXT,
  title TEXT,
  body TEXT,
  sender_name TEXT,
  sender_avatar TEXT,
  sent_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    nl.id,
    nl.type,
    nl.item_id,
    nl.item_type,
    nl.title,
    nl.body,
    p.full_name as sender_name,
    p.avatar_url as sender_avatar,
    nl.sent_at
  FROM notification_logs nl
  JOIN profiles p ON p.id = nl.sender_id
  WHERE nl.recipient_id = p_user_id
  ORDER BY nl.sent_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION get_recent_notifications TO authenticated;

-- 7. Test the setup
DO $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Please log in to test the notification setup';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing notification setup...';
  RAISE NOTICE 'Current user: %', current_user_id;

  -- Test notification stats function
  PERFORM * FROM get_notification_stats(current_user_id, 7);
  
  -- Test recent notifications function
  PERFORM * FROM get_recent_notifications(current_user_id, 5);
  
  RAISE NOTICE 'Notification setup test completed successfully!';
END $$; 