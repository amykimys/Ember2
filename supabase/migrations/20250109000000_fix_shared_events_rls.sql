-- =====================================================
-- FIX SHARED EVENTS RLS POLICY
-- =====================================================
-- This migration adds an RLS policy to allow users to view events
-- that have been shared with them, even if they don't own the events

-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own events" ON events;

-- Create a new SELECT policy that allows users to view:
-- 1. Their own events
-- 2. Events that have been shared with them
CREATE POLICY "Users can view their own and shared events" ON events
FOR SELECT USING (
  auth.uid() = user_id OR
  id IN (
    SELECT original_event_id 
    FROM shared_events 
    WHERE shared_with = auth.uid() 
    AND status = 'pending'
  )
);

-- Verify the policy was created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'events' 
AND cmd = 'SELECT'; 