-- Add target_per_week column to habits table
ALTER TABLE public.habits 
ADD COLUMN IF NOT EXISTS target_per_week INTEGER DEFAULT 7;

-- Add reminder_time column to habits table
ALTER TABLE public.habits 
ADD COLUMN IF NOT EXISTS reminder_time TIMESTAMP WITH TIME ZONE;

-- Add require_photo column to habits table
ALTER TABLE public.habits 
ADD COLUMN IF NOT EXISTS require_photo BOOLEAN DEFAULT FALSE;

-- Update existing habits to have a default target_per_week value
UPDATE public.habits 
SET target_per_week = 7 
WHERE target_per_week IS NULL; 