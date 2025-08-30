-- Add default_screen column to user_preferences table
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS default_screen TEXT DEFAULT 'todo' CHECK (default_screen IN ('todo', 'notes', 'profile'));

-- Update existing records to have the default value
UPDATE user_preferences 
SET default_screen = 'todo' 
WHERE default_screen IS NULL; 