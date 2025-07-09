const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSharedNotesSetup() {
  try {
    console.log('🔍 Testing shared_notes table setup...');

    // Read the SQL file
    const sqlContent = fs.readFileSync('test_shared_notes_simple.sql', 'utf8');

    // Check if table exists first
    const { data: tableExists, error: tableError } = await supabase
      .rpc('sql', { query: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_notes') as table_exists;" });

    if (tableError) {
      console.error('❌ Error checking if table exists:', tableError);
      return;
    }

    console.log('📋 Table exists check result:', tableExists);

    // If table doesn't exist, create it
    if (!tableExists || !tableExists[0]?.table_exists) {
      console.log('🔨 Creating shared_notes table...');
      
      const { error: createError } = await supabase
        .rpc('sql', { query: sqlContent });

      if (createError) {
        console.error('❌ Error creating table:', createError);
        return;
      }

      console.log('✅ Table created successfully');
    } else {
      console.log('✅ Table already exists');
    }

    // Test inserting a shared note
    console.log('🧪 Testing shared note insertion...');
    
    // First, get a user and a note to test with
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('❌ No authenticated user found');
      return;
    }

    console.log('👤 Current user:', user.id);

    // Get a note owned by the user
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, title')
      .eq('user_id', user.id)
      .limit(1);

    if (notesError || !notes || notes.length === 0) {
      console.log('❌ No notes found for user');
      return;
    }

    const testNote = notes[0];
    console.log('📝 Test note:', testNote);

    // Get a friend to share with
    const { data: friendships, error: friendshipsError } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .limit(1);

    if (friendshipsError || !friendships || friendships.length === 0) {
      console.log('❌ No friends found for user');
      return;
    }

    const testFriendId = friendships[0].friend_id;
    console.log('👥 Test friend ID:', testFriendId);

    // Try to insert a shared note
    const { data: insertData, error: insertError } = await supabase
      .from('shared_notes')
      .insert({
        original_note_id: testNote.id,
        shared_by: user.id,
        shared_with: testFriendId,
        can_edit: true,
        status: 'pending'
      })
      .select();

    if (insertError) {
      console.error('❌ Error inserting shared note:', insertError);
      return;
    }

    console.log('✅ Successfully inserted shared note:', insertData);

    // Test retrieving the shared note
    const { data: retrieveData, error: retrieveError } = await supabase
      .from('shared_notes')
      .select('*')
      .eq('original_note_id', testNote.id)
      .eq('shared_by', user.id);

    if (retrieveError) {
      console.error('❌ Error retrieving shared note:', retrieveError);
      return;
    }

    console.log('✅ Successfully retrieved shared notes:', retrieveData);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testSharedNotesSetup(); 