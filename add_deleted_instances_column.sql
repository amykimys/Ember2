-- Add deleted_instances column to todos table
ALTER TABLE todos 
ADD COLUMN IF NOT EXISTS deleted_instances TEXT[] DEFAULT '{}';

-- Add comment to explain the column
COMMENT ON COLUMN todos.deleted_instances IS 'Array of date strings (YYYY-MM-DD) for deleted instances of repeated tasks'; 