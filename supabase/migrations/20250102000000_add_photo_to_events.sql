-- Add photo column to events table
alter table public.events add column if not exists photo text; 