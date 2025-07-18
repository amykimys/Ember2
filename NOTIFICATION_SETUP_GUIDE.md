# 🔔 Notification Setup Guide (Edge Functions)

This guide will help you set up push notifications for shared tasks, events, and notes using Supabase Edge Functions instead of `pg_net`.

## 🎯 **What This Fixes**

- ✅ **Removes `pg_net` dependency** - No more database HTTP calls
- ✅ **Keeps all notifications** - Recipients still get push notifications
- ✅ **Better reliability** - Edge Functions are more stable than database triggers
- ✅ **Better tracking** - All notifications are logged in the database

## 📋 **Step-by-Step Setup**

### **Step 1: Apply the Database Fix**

1. **Go to your Supabase Dashboard**
2. **Open the SQL Editor**
3. **Run the `fix_share_tasks_no_pg_net.sql` script first**
4. **Then run the `setup_notifications_with_edge_function.sql` script**

### **Step 2: Deploy the Edge Function**

1. **Make sure you have Supabase CLI installed:**
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase:**
   ```bash
   npx supabase login
   ```

3. **Link your project:**
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

4. **Deploy the Edge Function:**
   ```bash
   npx supabase functions deploy send-share-notification
   ```

### **Step 3: Test the Setup**

1. **Create a test task** in your app
2. **Share it with a friend**
3. **Check if the recipient gets a push notification**

## 🔧 **How It Works**

### **Before (pg_net - Broken):**
```
Database Trigger → pg_net.http_post → Expo → Push Notification
```

### **After (Edge Functions - Working):**
```
App → Edge Function → Expo → Push Notification
```

## 📱 **Notification Types Supported**

- ✅ **Task Shared** - When someone shares a task with you
- ✅ **Event Shared** - When someone shares an event with you  
- ✅ **Note Shared** - When someone shares a note with you

## 🎨 **Notification Content**

**Task Shared:**
- Title: "📝 Task Shared"
- Body: "John shared 'Buy groceries' with you"

**Event Shared:**
- Title: "📅 Event Shared"  
- Body: "Jane shared 'Team Meeting' with you"

**Note Shared:**
- Title: "📄 Note Shared"
- Body: "Mike shared 'Meeting Notes' with you"

## 📊 **Notification Tracking**

All notifications are logged in the `notification_logs` table with:
- ✅ **Sender and recipient IDs**
- ✅ **Item type and ID**
- ✅ **Notification content**
- ✅ **Expo response data**
- ✅ **Timestamp**

## 🔍 **Testing Commands**

### **Test Database Functions:**
```bash
node test_share_tasks.js
```

### **Test Edge Function:**
```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-share-notification' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "task_shared",
    "recipientId": "RECIPIENT_USER_ID",
    "senderId": "SENDER_USER_ID", 
    "itemId": "TASK_ID",
    "itemTitle": "Test Task",
    "itemType": "task"
  }'
```

## 🚨 **Troubleshooting**

### **Issue: "Edge Function not found"**
**Solution:** Make sure you deployed the function correctly:
```bash
npx supabase functions deploy send-share-notification
```

### **Issue: "No push token found"**
**Solution:** Check that the recipient has:
- ✅ **Expo push token** in their profile
- ✅ **Push notifications enabled** in their profile

### **Issue: "Permission denied"**
**Solution:** Check that:
- ✅ **User is authenticated**
- ✅ **RLS policies are correct**
- ✅ **Service role key is set**

## 📈 **Monitoring**

### **Check Notification Logs:**
```sql
SELECT * FROM notification_logs 
WHERE recipient_id = 'YOUR_USER_ID' 
ORDER BY sent_at DESC 
LIMIT 10;
```

### **Get Notification Stats:**
```sql
SELECT * FROM get_notification_stats('YOUR_USER_ID', 30);
```

### **Get Recent Notifications:**
```sql
SELECT * FROM get_recent_notifications('YOUR_USER_ID', 20);
```

## 🎉 **Expected Results**

After setup, you should have:
- ✅ **No more `pg_net` errors**
- ✅ **Working task sharing**
- ✅ **Push notifications for recipients**
- ✅ **Notification tracking in database**
- ✅ **Better reliability and performance**

## 🔄 **Migration from pg_net**

If you had the old system:
1. **The new system is backward compatible**
2. **Old shared tasks will still work**
3. **New shares will use the Edge Function**
4. **No data migration needed**

## 📞 **Support**

If you encounter issues:
1. **Check the Supabase logs** for Edge Function errors
2. **Verify the recipient has a push token**
3. **Test with a simple notification first**
4. **Check the notification_logs table for errors**

---

**The new system provides the same functionality as before but with better reliability and no `pg_net` dependencies!** 🎉 