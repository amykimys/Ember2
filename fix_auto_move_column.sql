-- Add auto_move field to todos table
-- Run this script in your Supabase SQL editor to add the auto_move column back

ALTER TABLE public.todos 
ADD COLUMN IF NOT EXISTS auto_move boolean DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN public.todos.auto_move IS 'When true, this task will be automatically moved to the next day if not completed by midnight';

-- Update existing todos to have auto_move set to false by default
UPDATE public.todos 
SET auto_move = false 
WHERE auto_move IS NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'todos'
  AND column_name = 'auto_move';








