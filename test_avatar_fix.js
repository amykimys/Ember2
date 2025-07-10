const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAvatarFix() {
  try {
    console.log('🔍 Starting avatar fix test...');
    
    // Use Amy Kim's user ID directly
    const userId = 'cf77e7d5-5743-46d5-add9-de9a1db64fd4';
    
    console.log('✅ Using user ID:', userId);
    
    // Step 2: Add avatar URL to the user profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
      })
      .eq('id', userId);

    if (profileError) {
      console.error('❌ Error updating profile:', profileError);
      return;
    }

    console.log('✅ Avatar URL added to profile');
    
    // Step 3: Check for existing shared events
    const { data: existingSharedEvents, error: existingError } = await supabase
      .from('shared_events')
      .select(`
        id,
        original_event_id,
        shared_by,
        shared_with,
        status,
        created_at
      `)
      .eq('shared_with', userId)
      .eq('status', 'pending');

    if (existingError) {
      console.error('❌ Error checking existing shared events:', existingError);
      return;
    }

    console.log('✅ Found existing shared events:', existingSharedEvents.length);
    
    if (existingSharedEvents.length === 0) {
      console.log('⚠️ No existing shared events found. You may need to create a shared event through the app first.');
    } else {
      console.log('✅ Using existing shared events for testing');
    }
    
    // Step 5: Verify the profile has the avatar URL
    const { data: profileData, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .eq('id', userId)
      .single();

    if (profileCheckError) {
      console.error('❌ Error checking profile:', profileCheckError);
      return;
    }

    console.log('✅ Profile verification:', {
      id: profileData.id,
      username: profileData.username,
      full_name: profileData.full_name,
      avatar_url: profileData.avatar_url,
      hasAvatar: !!profileData.avatar_url
    });
    
    // Step 6: Test fetching shared events (using existing data)
    const sharedEventsData = existingSharedEvents;
    console.log('✅ Shared events found:', sharedEventsData.length);
    
    // Step 7: Test fetching profiles for shared events
    const allUserIds = new Set();
    sharedEventsData.forEach(se => {
      allUserIds.add(se.shared_by);
      allUserIds.add(se.shared_with);
    });
    
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', Array.from(allUserIds));

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      return;
    }

    console.log('✅ Profiles for shared events:', profilesData.map(p => ({
      id: p.id,
      username: p.username,
      full_name: p.full_name,
      avatar_url: p.avatar_url ? 'Yes' : 'No',
      avatar_url_value: p.avatar_url
    })));
    
    console.log('🎉 Avatar fix test completed successfully!');
    console.log('📱 Now open the app and check the shared events modal to see if the avatar appears.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAvatarFix(); 