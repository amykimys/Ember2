-- Add auto_move field to todos table
ALTER TABLE public.todos 
ADD COLUMN IF NOT EXISTS auto_move boolean DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN public.todos.auto_move IS 'When true, this task will be automatically moved to the next day if not completed by midnight'; 