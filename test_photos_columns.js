// Test script to check if photos columns exist in events table
const { createClient } = require('@supabase/supabase-js');

// You'll need to add your Supabase URL and anon key here
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPhotosColumns() {
  try {
    console.log('Testing if photos columns exist...');
    
    // Try to select from the photos column
    const { data: photosTest, error: photosError } = await supabase
      .from('events')
      .select('photos')
      .limit(1);
    
    console.log('Photos column test:', { data: photosTest, error: photosError });
    
    // Try to select from the private_photos column
    const { data: privatePhotosTest, error: privatePhotosError } = await supabase
      .from('events')
      .select('private_photos')
      .limit(1);
    
    console.log('Private photos column test:', { data: privatePhotosTest, error: privatePhotosError });
    
    // Check the table structure
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'events' });
    
    console.log('Table columns:', { data: columns, error: columnsError });
    
  } catch (error) {
    console.error('Error testing photos columns:', error);
  }
}

testPhotosColumns(); 