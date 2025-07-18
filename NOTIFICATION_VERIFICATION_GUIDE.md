# Notification System Verification Guide

This guide will help you verify if notifications for shared events/tasks/notes are being properly sent to recipients.

## 🔍 How to Check if Notifications Are Working

### 1. **Database-Level Verification**

#### Check if Database Triggers Exist
Run the SQL script `check_notification_triggers.sql` in your Supabase SQL editor:

```sql
-- Check if notification triggers are properly set up
SELECT 
    'Shared Events Trigger' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'shared_event_notification_trigger'
            AND event_object_table = 'shared_events'
        ) THEN '✅ Trigger exists'
        ELSE '❌ Trigger not found'
    END as status;
```

#### Check Recent Shared Items
```sql
-- Check recent shared events
SELECT COUNT(*) as recent_shared_events
FROM shared_events
WHERE created_at > NOW() - INTERVAL '7 days';

-- Check recent shared tasks  
SELECT COUNT(*) as recent_shared_tasks
FROM shared_tasks
WHERE created_at > NOW() - INTERVAL '7 days';

-- Check recent shared notes
SELECT COUNT(*) as recent_shared_notes
FROM shared_notes
WHERE created_at > NOW() - INTERVAL '7 days';
```

### 2. **Edge Function Verification**

#### Check Edge Function Logs
1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions** → **send-share-notification**
3. Check the **Logs** tab for recent activity
4. Look for entries like:
   ```
   🔔 [Share Notification] Received request: { table: 'shared_events', record: {...} }
   🔔 [Share Notification] Push notification sent successfully: {...}
   ```

#### Test Edge Function Manually
```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-share-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-anon-key" \
  -d '{
    "table": "shared_events",
    "record": {
      "shared_by": "sender-user-id",
      "shared_with": "recipient-user-id", 
      "original_event_id": "test-event-id"
    }
  }'
```

### 3. **User-Level Verification**

#### Check User Push Tokens
```sql
-- Check if users have push tokens
SELECT 
    id,
    full_name,
    CASE 
        WHEN expo_push_token IS NOT NULL THEN '✅ Has token'
        ELSE '❌ No token'
    END as token_status
FROM profiles
WHERE expo_push_token IS NOT NULL;
```

#### Check Notification Preferences
```sql
-- Check user notification preferences
SELECT 
    user_id,
    push_notifications,
    notifications_enabled
FROM user_preferences
WHERE push_notifications = true;
```

### 4. **App-Level Verification**

#### Run the Test Script
Execute the comprehensive test script:

```bash
node test_notification_system.js
```

This will check:
- ✅ User authentication
- ✅ Push token availability
- ✅ Notification preferences
- ✅ Database triggers
- ✅ Edge Function accessibility
- ✅ Recent shared items
- ✅ Manual notification test

#### Check App Logs
Look for these log messages in your app:

**When sharing:**
```
🔔 [Event Shared Notification] Sending push notification to user: recipient-id
🔔 [Event Shared Notification] Push notification sent successfully: {...}
```

**When receiving:**
```
🔔 [Notifications] Notification received: [Sender Name] shared an event with you
```

### 5. **Device-Level Verification**

#### Check Device Notifications
1. **iOS**: Check Notification Center and Settings → Notifications → Your App
2. **Android**: Check notification tray and Settings → Apps → Your App → Notifications
3. **Expo Go**: Check the Expo Go app notifications

#### Test Notification Permissions
```javascript
// In your app, check notification permissions
import * as Notifications from 'expo-notifications';

const { status } = await Notifications.getPermissionsAsync();
console.log('Notification permission status:', status);
// Should be 'granted' for notifications to work
```

## 🚨 Common Issues and Solutions

### Issue 1: No Push Token Found
**Symptoms:**
- `❌ No push token found` in logs
- Users don't receive notifications

**Solutions:**
1. Ensure the app requests notification permissions on first launch
2. Check if the device supports push notifications
3. Verify Expo configuration in `app.json`

### Issue 2: Database Triggers Missing
**Symptoms:**
- `❌ Trigger not found` in database checks
- No Edge Function calls when sharing

**Solutions:**
1. Run the trigger creation scripts:
   ```sql
   -- Run create_share_notification_triggers_simple.sql
   ```
2. Check if `pg_net` extension is enabled
3. Verify Edge Function URL in trigger functions

### Issue 3: Edge Function Failing
**Symptoms:**
- Error logs in Edge Function
- `❌ Edge Function test failed`

**Solutions:**
1. Check Edge Function logs in Supabase Dashboard
2. Verify environment variables are set
3. Test Edge Function manually with curl

### Issue 4: Notifications Disabled
**Symptoms:**
- `❌ Push notifications disabled in preferences`
- Users have tokens but don't receive notifications

**Solutions:**
1. Check user preferences in database
2. Ensure app requests notification permissions
3. Guide users to enable notifications in app settings

## 🧪 Testing Notifications

### Step-by-Step Test Process

1. **Setup Test Users**
   ```sql
   -- Create test users with push tokens
   INSERT INTO profiles (id, full_name, expo_push_token) 
   VALUES ('test-user-1', 'Test User 1', 'ExponentPushToken[...]');
   ```

2. **Share an Item**
   - Use the app to share an event/task/note between test users
   - Monitor the sharing process

3. **Check Database**
   ```sql
   -- Verify shared item was created
   SELECT * FROM shared_events WHERE shared_by = 'test-user-1' ORDER BY created_at DESC LIMIT 1;
   ```

4. **Check Edge Function Logs**
   - Look for notification attempts in Supabase Dashboard
   - Verify successful push notification delivery

5. **Check Device**
   - Verify notification appears on recipient's device
   - Test notification interaction

### Manual Notification Test
```javascript
// Test sending a notification manually
const response = await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'ExponentPushToken[...]',
    title: 'Test Notification',
    body: 'This is a test notification',
    data: { type: 'test' },
    sound: 'default',
    priority: 'high',
  }),
});
```

## 📊 Monitoring and Debugging

### Key Metrics to Monitor
- Number of shared items created
- Edge Function invocation count
- Push notification delivery rate
- User notification preferences
- Push token availability

### Debug Commands
```bash
# Check notification system status
node test_notification_system.js

# Check database triggers
# Run check_notification_triggers.sql in Supabase SQL editor

# Monitor Edge Function logs
# Check Supabase Dashboard → Edge Functions → Logs
```

## ✅ Success Criteria

Notifications are working correctly when:
1. ✅ Database triggers exist and are active
2. ✅ Edge Function receives requests and responds successfully
3. ✅ Users have valid push tokens
4. ✅ Notification preferences are enabled
5. ✅ Push notifications are delivered to devices
6. ✅ Users can interact with notifications

## 🔧 Troubleshooting Checklist

- [ ] User has granted notification permissions
- [ ] User has a valid push token in database
- [ ] User has enabled push notifications in preferences
- [ ] Database triggers are properly installed
- [ ] Edge Function is deployed and accessible
- [ ] Edge Function has correct environment variables
- [ ] Device supports push notifications
- [ ] App is properly configured for Expo notifications
- [ ] Network connectivity is available
- [ ] Expo push service is operational 