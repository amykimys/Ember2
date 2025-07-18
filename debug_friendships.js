const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkFriendships() {
  console.log('🔍 Checking friendships table...\n');
  
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('❌ Not logged in');
      return;
    }
    
    console.log('👤 Current user ID:', user.id);
    
    // Check all friendships
    const { data: allFriendships, error: allError } = await supabase
      .from('friendships')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (allError) {
      console.error('❌ Error fetching all friendships:', allError);
      return;
    }
    
    console.log('📊 Total friendships in database:', allFriendships?.length || 0);
    
    // Check for self-friendships
    const selfFriendships = allFriendships?.filter(f => f.user_id === f.friend_id) || [];
    console.log('🚨 Self-friendships found:', selfFriendships.length);
    
    if (selfFriendships.length > 0) {
      console.log('🚨 Self-friendships details:');
      selfFriendships.forEach(f => {
        console.log(`  - ID: ${f.id}, User: ${f.user_id}, Status: ${f.status}`);
      });
    }
    
    // Check user's friendships
    const { data: userFriendships, error: userFriendshipsError } = await supabase
      .from('friendships')
      .select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .eq('status', 'accepted');
    
    if (userFriendshipsError) {
      console.error('❌ Error fetching user friendships:', userFriendshipsError);
      return;
    }
    
    console.log('\n👥 User\'s accepted friendships:', userFriendships?.length || 0);
    
    if (userFriendships && userFriendships.length > 0) {
      console.log('👥 User\'s friendships details:');
      userFriendships.forEach(f => {
        const isSelf = f.user_id === f.friend_id;
        const friendId = f.user_id === user.id ? f.friend_id : f.user_id;
        console.log(`  - ID: ${f.id}, User: ${f.user_id}, Friend: ${f.friend_id}, Status: ${f.status}, Self: ${isSelf}, Friend ID: ${friendId}`);
      });
    }
    
    // Check user's profile
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('❌ Error fetching user profile:', profileError);
    } else {
      console.log('\n👤 User profile:', userProfile);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkFriendships(); 