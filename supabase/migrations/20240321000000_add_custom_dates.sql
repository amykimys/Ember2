-- Add custom_dates column to events table
ALTER TABLE events
ADD COLUMN custom_dates TEXT[] DEFAULT NULL; 