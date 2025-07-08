-- Add auto_move_uncompleted_tasks preference to user_preferences table
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS auto_move_uncompleted_tasks boolean DEFAULT false;
 
-- Add comment to explain the new column
COMMENT ON COLUMN public.user_preferences.auto_move_uncompleted_tasks IS 'When enabled, uncompleted tasks will be automatically moved to the next day after midnight'; 