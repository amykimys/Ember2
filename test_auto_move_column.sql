-- Test if auto_move column exists and what data it contains
-- Run this in your Supabase SQL Editor

-- 1. Check if auto_move column exists
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'todos' 
AND column_name = 'auto_move';

-- 2. Check what auto_move data looks like
SELECT id, text, auto_move, 
       CASE 
         WHEN auto_move IS NULL THEN 'NULL'
         WHEN auto_move = true THEN 'true (boolean)'
         WHEN auto_move = 'true' THEN 'true (string)'
         WHEN auto_move = false THEN 'false (boolean)'
         WHEN auto_move = 'false' THEN 'false (string)'
         ELSE 'other: ' || auto_move::text
       END as auto_move_status
FROM todos 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Count tasks by auto_move status
SELECT 
  CASE 
    WHEN auto_move IS NULL THEN 'NULL'
    WHEN auto_move = true THEN 'true'
    WHEN auto_move = false THEN 'false'
    ELSE 'other'
  END as auto_move_status,
  COUNT(*) as count
FROM todos 
GROUP BY auto_move_status;




