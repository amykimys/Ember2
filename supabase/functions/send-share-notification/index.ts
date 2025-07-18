import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deno types
declare global {
  interface Window {
    Deno: {
      env: {
        get(key: string): string | undefined;
      };
    };
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse the request body
    const { 
      type, 
      recipientId, 
      senderId, 
      itemId, 
      itemTitle, 
      itemType = 'task'
    } = await req.json()

    console.log('🔔 [Edge Function] Processing notification:', {
      type,
      recipientId,
      senderId,
      itemId,
      itemTitle,
      itemType
    })

    // Get recipient's push token
    const { data: recipientProfile, error: profileError } = await supabase
      .from('profiles')
      .select('expo_push_token, push_notifications_enabled')
      .eq('id', recipientId)
      .single()

    if (profileError) {
      console.error('❌ Error fetching recipient profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch recipient profile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if recipient has push notifications enabled
    if (!recipientProfile.push_notifications_enabled) {
      console.log('📱 Recipient has push notifications disabled')
      return new Response(
        JSON.stringify({ message: 'Recipient has push notifications disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if recipient has a push token
    if (!recipientProfile.expo_push_token) {
      console.log('📱 Recipient has no push token')
      return new Response(
        JSON.stringify({ message: 'Recipient has no push token' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get sender's profile for notification content
    const { data: senderProfile, error: senderError } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', senderId)
      .single()

    if (senderError) {
      console.error('❌ Error fetching sender profile:', senderError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sender profile' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare notification content based on type
    let title = ''
    let body = ''
    let data = {}

    switch (type) {
      case 'task_shared':
        title = '📝 Task Shared'
        body = `${senderProfile.full_name || senderProfile.username} shared "${itemTitle}" with you`
        data = {
          type: 'task_shared',
          itemId,
          itemType: 'task',
          senderId,
          senderName: senderProfile.full_name || senderProfile.username
        }
        break

      case 'event_shared':
        title = '📅 Event Shared'
        body = `${senderProfile.full_name || senderProfile.username} shared "${itemTitle}" with you`
        data = {
          type: 'event_shared',
          itemId,
          itemType: 'event',
          senderId,
          senderName: senderProfile.full_name || senderProfile.username
        }
        break

      case 'note_shared':
        title = '📄 Note Shared'
        body = `${senderProfile.full_name || senderProfile.username} shared "${itemTitle}" with you`
        data = {
          type: 'note_shared',
          itemId,
          itemType: 'note',
          senderId,
          senderName: senderProfile.full_name || senderProfile.username
        }
        break

      default:
        title = '📤 Item Shared'
        body = `${senderProfile.full_name || senderProfile.username} shared something with you`
        data = {
          type: 'item_shared',
          itemId,
          itemType,
          senderId,
          senderName: senderProfile.full_name || senderProfile.username
        }
    }

    // Send push notification via Expo
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: recipientProfile.expo_push_token,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high',
        channelId: 'share-notifications',
      }),
    })

    if (!expoResponse.ok) {
      const errorText = await expoResponse.text()
      console.error('❌ Expo push notification failed:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to send push notification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const expoResult = await expoResponse.json()
    console.log('✅ Push notification sent successfully:', expoResult)

    // Log the notification in the database for tracking
    await supabase
      .from('notification_logs')
      .insert({
        recipient_id: recipientId,
        sender_id: senderId,
        type,
        item_id: itemId,
        item_type: itemType,
        title,
        body,
        sent_at: new Date().toISOString(),
        expo_response: expoResult
      })

    return new Response(
      JSON.stringify({ 
      success: true, 
        message: 'Notification sent successfully',
        expoResult 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}) 