-- Check the single shared event that exists
SELECT 
    id,
    original_event_id,
    shared_by,
    shared_with,
    status,
    created_at,
    event_data IS NOT NULL as has_event_data
FROM shared_events
WHERE id = 'e5784158-b096-4130-bb0b-d2f96df7c0fc'; 