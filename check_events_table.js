const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEventsTable() {
  console.log('🔍 [Check] Checking events table...');
  
  try {
    // Check if we can access the events table
    console.log('\n📋 Step 1: Check events table access');
    const { data: tableCheck, error: tableError } = await supabase
      .from('events')
      .select('count')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Cannot access events table:', tableError);
      return;
    }
    console.log('✅ Can access events table');
    
    // Check all events
    console.log('\n📋 Step 2: Check all events');
    const { data: allEvents, error: allError } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (allError) {
      console.error('❌ Error fetching events:', allError);
      return;
    }
    
    console.log(`📊 Total events found: ${allEvents?.length || 0}`);
    
    if (allEvents && allEvents.length > 0) {
      console.log('\n📋 Recent events:');
      allEvents.forEach((event, index) => {
        console.log(`\n--- Event ${index + 1} ---`);
        console.log('ID:', event.id);
        console.log('Title:', event.title);
        console.log('Date:', event.date);
        console.log('User ID:', event.user_id);
        console.log('Created at:', event.created_at);
      });
    }
    
    // Check events for your user ID
    const yourUserId = 'cf77e7d5-5743-46d5-add9-de9a1db64fd4';
    console.log(`\n📋 Step 3: Check events for your user ID: ${yourUserId}`);
    
    const { data: yourEvents, error: yourEventsError } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', yourUserId)
      .order('created_at', { ascending: false });
    
    if (yourEventsError) {
      console.error('❌ Error fetching your events:', yourEventsError);
      return;
    }
    
    console.log(`📊 Your events: ${yourEvents?.length || 0}`);
    
    if (yourEvents && yourEvents.length > 0) {
      console.log('\n📋 Your recent events:');
      yourEvents.slice(0, 5).forEach((event, index) => {
        console.log(`\n--- Your Event ${index + 1} ---`);
        console.log('ID:', event.id);
        console.log('Title:', event.title);
        console.log('Date:', event.date);
        console.log('Created at:', event.created_at);
      });
    }
    
    console.log('\n✅ Events table check completed!');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkEventsTable(); 