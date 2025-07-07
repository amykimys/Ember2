-- Remove 'friends' option from default_screen constraint and update existing records
-- First, update any existing records that have 'friends' as default_screen to 'calendar'
UPDATE user_preferences 
SET default_screen = 'calendar' 
WHERE default_screen = 'friends';

-- Drop the existing constraint
ALTER TABLE user_preferences 
DROP CONSTRAINT IF EXISTS user_preferences_default_screen_check;

-- Add the new constraint without 'friends'
ALTER TABLE user_preferences 
ADD CONSTRAINT user_preferences_default_screen_check 
CHECK (default_screen IN ('calendar', 'todo', 'notes', 'profile')); 