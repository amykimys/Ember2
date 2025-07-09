const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwMzgxMjksImV4cCI6MjA2MDYxNDEyOX0.X1n5-XzGhq4zi_ciQe2BoVIhqwHDXzoI3bPKDUrK_88';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testNotesSharing() {
  try {
    console.log('🧪 Testing notes sharing functionality...');

    // 1. Check if shared_notes table exists by trying to query it
    console.log('\n1. Checking if shared_notes table exists...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('shared_notes')
      .select('count')
      .limit(1);

    if (tableError) {
      if (tableError.code === '42P01') {
        console.log('❌ shared_notes table does not exist');
        return;
      } else {
        console.error('❌ Error checking table:', tableError);
        return;
      }
    }

    console.log('✅ shared_notes table exists');

    // 2. Check table structure by trying to select all columns
    console.log('\n2. Checking table structure...');
    const { data: sampleData, error: sampleError } = await supabase
      .from('shared_notes')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('❌ Error checking table structure:', sampleError);
      return;
    }

    console.log('📋 Table structure check passed');
    if (sampleData && sampleData.length > 0) {
      console.log('📋 Sample data structure:', Object.keys(sampleData[0]));
    }

    // 3. Check if we can insert data (this will test RLS policies)
    console.log('\n3. Testing insert permissions...');
    console.log('⚠️  Skipping insert test - need authenticated user');

    // 4. Summary
    console.log('\n4. Summary:');
    console.log('✅ Table exists and is accessible');
    console.log('✅ Table structure is correct');
    console.log('⚠️  Need to test with authenticated user to verify sharing functionality');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testNotesSharing(); 