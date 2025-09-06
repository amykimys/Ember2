-- Add auto_move field to todos table
-- This migration adds back the auto_move column that was previously removed

ALTER TABLE public.todos 
ADD COLUMN IF NOT EXISTS auto_move boolean DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN public.todos.auto_move IS 'When true, this task will be automatically moved to the next day if not completed by midnight';

-- Update existing todos to have auto_move set to false by default
UPDATE public.todos 
SET auto_move = false 
WHERE auto_move IS NULL;








