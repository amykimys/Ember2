SELECT 
    se.id as shared_event_id,
    se.status,
    e.title,
    e.description,
    e.date,
    e.start_datetime,
    e.end_datetime,
    e.is_all_day,
    p.full_name as shared_by_name
FROM shared_events se
JOIN events e ON se.original_event_id = e.id
JOIN profiles p ON se.shared_by = p.id
WHERE se.status = 'pending'
ORDER BY se.created_at DESC
LIMIT 5;
