-- Add default_screen column to user_preferences table
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS default_screen TEXT DEFAULT 'calendar' CHECK (default_screen IN ('calendar', 'todo', 'notes', 'profile'));

-- Update existing records to have the default value
UPDATE user_preferences 
SET default_screen = 'calendar' 
WHERE default_screen IS NULL; 