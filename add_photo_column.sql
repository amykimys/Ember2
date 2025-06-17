-- Add photo column to todos table
ALTER TABLE todos ADD COLUMN photo TEXT;

-- Add comment to document the column
COMMENT ON COLUMN todos.photo IS 'URL of the photo attached to this task'; 