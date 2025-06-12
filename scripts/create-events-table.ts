import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createEventsTable() {
  try {
    console.log('Creating events table...');
    
    // Create events table
    const { error: createTableError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create events table
        create table if not exists public.events (
          id uuid default gen_random_uuid() primary key,
          user_id uuid references auth.users(id) on delete cascade not null,
          title text not null,
          description text,
          location text,
          date text not null,
          start_datetime timestamp with time zone,
          end_datetime timestamp with time zone,
          category_name text,
          category_color text,
          reminder_time timestamp with time zone,
          repeat_option text check (repeat_option in ('None', 'Daily', 'Weekly', 'Monthly', 'Yearly', 'Custom')) default 'None',
          repeat_end_date timestamp with time zone,
          custom_dates text[],
          custom_times jsonb,
          is_all_day boolean default false,
          created_at timestamp with time zone default timezone('utc'::text, now()) not null,
          updated_at timestamp with time zone default timezone('utc'::text, now()) not null
        );

        -- Add indexes for better performance
        create index if not exists events_user_id_idx on public.events(user_id);
        create index if not exists events_date_idx on public.events(date);
        create index if not exists events_start_datetime_idx on public.events(start_datetime);

        -- Enable Row Level Security (RLS)
        alter table public.events enable row level security;

        -- Drop existing policies if they exist
        drop policy if exists "Users can view their own events" on public.events;
        drop policy if exists "Users can create their own events" on public.events;
        drop policy if exists "Users can update their own events" on public.events;
        drop policy if exists "Users can delete their own events" on public.events;

        -- Create policies
        create policy "Users can view their own events"
          on public.events for select
          using (auth.uid() = user_id);

        create policy "Users can create their own events"
          on public.events for insert
          with check (auth.uid() = user_id);

        create policy "Users can update their own events"
          on public.events for update
          using (auth.uid() = user_id);

        create policy "Users can delete their own events"
          on public.events for delete
          using (auth.uid() = user_id);

        -- Create function to handle updated_at
        create or replace function public.handle_events_updated_at()
        returns trigger
        language plpgsql
        as $$
        begin
          NEW.updated_at = timezone('utc'::text, now());
          return NEW;
        end;
        $$;

        -- Create trigger for updated_at
        drop trigger if exists handle_events_updated_at on public.events;
        create trigger handle_events_updated_at
          before update on public.events
          for each row
          execute function public.handle_events_updated_at();
      `
    });

    if (createTableError) {
      console.error('Error creating events table:', createTableError);
      return;
    }

    console.log('Events table created successfully!');
    
    // Test the table
    const { data: testData, error: testError } = await supabase
      .from('events')
      .select('count')
      .limit(1);
    
    console.log('Test query result:', testData);
    console.log('Test query error:', testError);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createEventsTable(); 