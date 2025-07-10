-- Create triggers to send notifications when someone shares an event or task with you

-- Enable the http extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";

-- Function to call the Edge Function for shared events
CREATE OR REPLACE FUNCTION handle_shared_event_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the Edge Function to send notification
  PERFORM
    extensions.http_post(
      url := 'https://ogwuamsvucvtfbxjxwqq.supabase.co/functions/v1/send-share-notification',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}',
      body := json_build_object(
        'table', 'shared_events',
        'record', row_to_json(NEW)
      )::text
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to call the Edge Function for shared tasks
CREATE OR REPLACE FUNCTION handle_shared_task_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the Edge Function to send notification
  PERFORM
    extensions.http_post(
      url := 'https://ogwuamsvucvtfbxjxwqq.supabase.co/functions/v1/send-share-notification',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}',
      body := json_build_object(
        'table', 'shared_tasks',
        'record', row_to_json(NEW)
      )::text
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS shared_event_notification_trigger ON shared_events;
CREATE TRIGGER shared_event_notification_trigger
  AFTER INSERT ON shared_events
  FOR EACH ROW
  EXECUTE FUNCTION handle_shared_event_notification();

DROP TRIGGER IF EXISTS shared_task_notification_trigger ON shared_tasks;
CREATE TRIGGER shared_task_notification_trigger
  AFTER INSERT ON shared_tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_shared_task_notification(); 