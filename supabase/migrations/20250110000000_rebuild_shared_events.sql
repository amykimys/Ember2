-- =====================================================
-- REBUILD SHARED EVENTS SYSTEM
-- =====================================================

-- Drop existing shared_events table if it exists
DROP TABLE IF EXISTS shared_events CASCADE;

-- Create new shared_events table with proper structure
CREATE TABLE shared_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    original_event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(original_event_id, shared_by, shared_with)
);

-- Create indexes for better performance
CREATE INDEX idx_shared_events_shared_with ON shared_events(shared_with);
CREATE INDEX idx_shared_events_status ON shared_events(status);
CREATE INDEX idx_shared_events_shared_by ON shared_events(shared_by);
CREATE INDEX idx_shared_events_original_event ON shared_events(original_event_id);

-- Enable RLS
ALTER TABLE shared_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared_events table
CREATE POLICY "Users can view shared events they're involved in" ON shared_events
    FOR SELECT USING (
        auth.uid() = shared_by OR 
        auth.uid() = shared_with
    );

CREATE POLICY "Users can create shared events" ON shared_events
    FOR INSERT WITH CHECK (
        auth.uid() = shared_by
    );

CREATE POLICY "Recipients can update shared events" ON shared_events
    FOR UPDATE USING (
        auth.uid() = shared_with
    );

CREATE POLICY "Users can delete their own shared events" ON shared_events
    FOR DELETE USING (
        auth.uid() = shared_by
    );

-- Update events table RLS to allow viewing shared events
DROP POLICY IF EXISTS "Users can view their own events" ON events;
DROP POLICY IF EXISTS "Users can view their own and shared events" ON events;

CREATE POLICY "Users can view their own and shared events" ON events
    FOR SELECT USING (
        auth.uid() = user_id OR
        id IN (
            SELECT original_event_id 
            FROM shared_events 
            WHERE shared_with = auth.uid() 
            AND status IN ('pending', 'accepted')
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shared_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_shared_events_updated_at
    BEFORE UPDATE ON shared_events
    FOR EACH ROW
    EXECUTE FUNCTION update_shared_events_updated_at();

-- Insert test data
INSERT INTO events (
    id,
    user_id,
    title,
    description,
    date,
    start_datetime,
    end_datetime,
    category_name,
    category_color,
    is_all_day,
    created_at
) VALUES (
    'test_shared_event_2025_01_15',
    'bc7c0bbd-f252-448d-885b-27f69c180ee6',  -- Test user ID
    'Test Shared Event',
    'This is a test event to verify sharing works',
    '2025-01-15',
    '2025-01-15T10:00:00Z',
    '2025-01-15T11:00:00Z',
    'Test',
    '#FF6B6B',
    false,
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Share the test event
INSERT INTO shared_events (
    original_event_id,
    shared_by,
    shared_with,
    status,
    message,
    created_at
) VALUES (
    'test_shared_event_2025_01_15',
    'bc7c0bbd-f252-448d-885b-27f69c180ee6',  -- Test user ID
    'cf77e7d5-5743-46d5-add9-de9a1db64fd4',  -- Your user ID
    'pending',
    'Hey! Check out this event I want to share with you.',
    NOW()
) ON CONFLICT (original_event_id, shared_by, shared_with) DO NOTHING; 