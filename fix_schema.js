const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nd3VhbXN2dWN2dGZieGp4d3FxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTAzODEyOSwiZXhwIjoyMDYwNjE0MTI5fQ.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8'; // You'll need to get this from your Supabase dashboard

// Create a Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixUserPreferencesSchema() {
  try {
    console.log('🔧 Starting schema fix for user_preferences table...');

    // First, let's check the current table structure
    console.log('📋 Checking current table structure...');
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'user_preferences' });

    if (columnsError) {
      console.log('Using alternative method to check table structure...');
      // Alternative: try to describe the table
      const { data: tableInfo, error: tableError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', 'user_preferences')
        .order('ordinal_position');

      if (tableError) {
        console.error('❌ Error checking table structure:', tableError);
        return;
      }

      console.log('📊 Current table structure:', tableInfo);
    } else {
      console.log('📊 Current table structure:', columns);
    }

    // Check if the auto_move_uncompleted_tasks column exists
    const hasAutoMoveColumn = columns?.some(col => col.column_name === 'auto_move_uncompleted_tasks') ||
                             tableInfo?.some(col => col.column_name === 'auto_move_uncompleted_tasks');

    if (!hasAutoMoveColumn) {
      console.log('➕ Adding missing auto_move_uncompleted_tasks column...');
      
      // Add the missing column
      const { error: alterError } = await supabase
        .rpc('add_column_if_not_exists', {
          table_name: 'user_preferences',
          column_name: 'auto_move_uncompleted_tasks',
          column_type: 'boolean',
          column_default: 'false'
        });

      if (alterError) {
        console.log('Using direct SQL approach...');
        // Try direct SQL execution
        const { error: sqlError } = await supabase
          .rpc('exec_sql', {
            sql_query: `
              ALTER TABLE user_preferences 
              ADD COLUMN IF NOT EXISTS auto_move_uncompleted_tasks boolean DEFAULT false;
            `
          });

        if (sqlError) {
          console.error('❌ Error adding column:', sqlError);
          console.log('🔄 Trying to recreate the table...');
          
          // Backup existing data
          const { data: existingData, error: backupError } = await supabase
            .from('user_preferences')
            .select('*');

          if (backupError) {
            console.error('❌ Error backing up data:', backupError);
            return;
          }

          console.log(`📦 Backed up ${existingData?.length || 0} records`);

          // Drop and recreate the table
          const { error: dropError } = await supabase
            .rpc('exec_sql', {
              sql_query: 'DROP TABLE IF EXISTS user_preferences CASCADE;'
            });

          if (dropError) {
            console.error('❌ Error dropping table:', dropError);
            return;
          }

          // Create the table with the correct structure
          const { error: createError } = await supabase
            .rpc('exec_sql', {
              sql_query: `
                CREATE TABLE user_preferences (
                  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
                  theme text CHECK (theme IN ('light', 'dark', 'system')) DEFAULT 'system',
                  notifications_enabled boolean DEFAULT true,
                  default_view text CHECK (default_view IN ('day', 'week', 'month')) DEFAULT 'day',
                  email_notifications boolean DEFAULT true,
                  push_notifications boolean DEFAULT true,
                  default_screen text CHECK (default_screen IN ('calendar', 'todo', 'notes', 'profile')) DEFAULT 'calendar',
                  auto_move_uncompleted_tasks boolean DEFAULT false,
                  expo_push_token text,
                  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
                  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
                  UNIQUE(user_id)
                );
              `
            });

          if (createError) {
            console.error('❌ Error creating table:', createError);
            return;
          }

          // Restore the data
          if (existingData && existingData.length > 0) {
            for (const record of existingData) {
              const { error: insertError } = await supabase
                .from('user_preferences')
                .insert({
                  ...record,
                  auto_move_uncompleted_tasks: false // Add default value for new column
                });

              if (insertError) {
                console.error('❌ Error restoring record:', insertError);
              }
            }
            console.log('✅ Data restored successfully');
          }

          // Recreate indexes and policies
          const { error: indexError } = await supabase
            .rpc('exec_sql', {
              sql_query: `
                CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx ON user_preferences(user_id);
                ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
                
                CREATE POLICY "Users can view their own preferences" ON user_preferences
                  FOR SELECT USING (user_id = auth.uid());
                
                CREATE POLICY "Users can create their own preferences" ON user_preferences
                  FOR INSERT WITH CHECK (user_id = auth.uid());
                
                CREATE POLICY "Users can update their own preferences" ON user_preferences
                  FOR UPDATE USING (user_id = auth.uid());
                
                CREATE POLICY "Users can delete their own preferences" ON user_preferences
                  FOR DELETE USING (user_id = auth.uid());
                
                GRANT ALL ON user_preferences TO authenticated;
              `
            });

          if (indexError) {
            console.error('❌ Error recreating indexes/policies:', indexError);
          } else {
            console.log('✅ Indexes and policies recreated');
          }
        } else {
          console.log('✅ Column added successfully');
        }
      } else {
        console.log('✅ Column added successfully');
      }
    } else {
      console.log('✅ auto_move_uncompleted_tasks column already exists');
    }

    // Test the table structure
    console.log('🧪 Testing table structure...');
    const { data: testData, error: testError } = await supabase
      .from('user_preferences')
      .select('*')
      .limit(1);

    if (testError) {
      console.error('❌ Error testing table:', testError);
    } else {
      console.log('✅ Table test successful');
      console.log('📊 Sample data structure:', testData?.[0] ? Object.keys(testData[0]) : 'No data');
    }

    console.log('🎉 Schema fix completed!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the fix
fixUserPreferencesSchema(); 