#!/bin/bash

echo "🚀 Deploying Share Notification System..."

# Step 1: Deploy the Edge Function
echo "📦 Deploying Edge Function..."
npx supabase functions deploy send-share-notification

# Step 2: Add expo_push_token column to profiles table
echo "🗄️ Adding expo_push_token column to profiles table..."
npx supabase db reset --linked

# Step 3: Create database triggers
echo "🔧 Creating database triggers..."
npx supabase db reset --linked
psql $DATABASE_URL -f create_share_notification_triggers_simple.sql

echo "✅ Share notification system deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Test the system by sharing a task or habit with another user"
echo "2. Check that the recipient receives a push notification"
echo "3. Verify the notification includes the sender's name and item title"
echo ""
echo "🔧 To test manually:"
echo "- Share a task from the todo screen"
echo "- Share a habit from the habits screen"
echo "- Check the recipient's device for push notifications" 