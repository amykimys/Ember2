-- Add category columns to events table
ALTER TABLE events
ADD COLUMN category_name TEXT DEFAULT NULL,
ADD COLUMN category_color TEXT DEFAULT NULL;

-- Add comment to explain the columns
COMMENT ON COLUMN events.category_name IS 'The name of the category associated with this event';
COMMENT ON COLUMN events.category_color IS 'The color code of the category associated with this event'; 