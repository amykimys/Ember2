import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Add type definitions for Deno
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

serve(async (req) => {
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
    const { record, table } = await req.json()

    console.log('🔔 [Share Notification] Received request:', { table, record })

    // Determine what type of share this is
    let recipientId: string
    let senderId: string
    let itemType: 'event' | 'task'
    let itemId: string

    if (table === 'shared_events') {
      recipientId = record.shared_with
      senderId = record.shared_by
      itemType = 'event'
      itemId = record.original_event_id
    } else if (table === 'shared_tasks') {
      recipientId = record.shared_with
      senderId = record.shared_by
      itemType = 'task'
      itemId = record.original_task_id
    } else {
      throw new Error(`Unsupported table: ${table}`)
    }

    // Don't send notification if sharing with self
    if (recipientId === senderId) {
      console.log('🔔 [Share Notification] Skipping self-share notification')
      return new Response(JSON.stringify({ success: true, skipped: 'self-share' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Get recipient's profile (for push token)
    const { data: recipientProfile, error: profileError } = await supabase
      .from('profiles')
      .select('expo_push_token, full_name')
      .eq('id', recipientId)
      .single()

    if (profileError || !recipientProfile?.expo_push_token) {
      console.log('🔔 [Share Notification] No push token found for recipient:', recipientId)
      return new Response(JSON.stringify({ success: true, skipped: 'no-push-token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Get sender's profile (for name)
    const { data: senderProfile, error: senderError } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', senderId)
      .single()

    if (senderError) {
      console.error('🔔 [Share Notification] Error fetching sender profile:', senderError)
      return new Response(JSON.stringify({ error: 'Failed to fetch sender profile' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Get the item details (event or task title)
    let itemDetails
    if (itemType === 'event') {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('title')
        .eq('id', itemId)
        .single()

      if (eventError) {
        console.error('🔔 [Share Notification] Error fetching event:', eventError)
        return new Response(JSON.stringify({ error: 'Failed to fetch event details' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
      itemDetails = eventData
    } else {
      const { data: taskData, error: taskError } = await supabase
        .from('todos')
        .select('title')
        .eq('id', itemId)
        .single()

      if (taskError) {
        console.error('🔔 [Share Notification] Error fetching task:', taskError)
        return new Response(JSON.stringify({ error: 'Failed to fetch task details' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
      itemDetails = taskData
    }

    // Prepare notification data
    const senderName = senderProfile.full_name || senderProfile.username || 'Someone'
    const itemTitle = itemDetails.title || 'Untitled'
    const notificationTitle = `${senderName} shared a ${itemType} with you`
    const notificationBody = itemTitle

    // Send push notification via Expo
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: recipientProfile.expo_push_token,
        title: notificationTitle,
        body: notificationBody,
        data: {
          type: 'shared_item',
          itemType,
          itemId,
          senderId,
          senderName,
          itemTitle,
        },
        sound: 'default',
        priority: 'high',
      }),
    })

    if (!expoResponse.ok) {
      const expoError = await expoResponse.text()
      console.error('🔔 [Share Notification] Expo push failed:', expoError)
      return new Response(JSON.stringify({ error: 'Failed to send push notification' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const expoResult = await expoResponse.json()
    console.log('🔔 [Share Notification] Push notification sent successfully:', expoResult)

    return new Response(JSON.stringify({ 
      success: true, 
      notification: {
        title: notificationTitle,
        body: notificationBody,
        recipientId,
        senderId,
        itemType,
        itemId,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('🔔 [Share Notification] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}) 