import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ogwuamsvucvtfbxjxwqq.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createNotesTable() {
  try {
    // Create notes table
    const { error: createTableError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create notes table
        create table if not exists public.notes (
          id uuid default gen_random_uuid() primary key,
          user_id uuid references auth.users(id) on delete cascade not null,
          title text not null,
          content text not null,
          color text default '#FFFFFF',
          created_at timestamp with time zone default timezone('utc'::text, now()) not null,
          updated_at timestamp with time zone default timezone('utc'::text, now()) not null
        );

        -- Add indexes
        create index if not exists notes_user_id_idx on public.notes(user_id);
        create index if not exists notes_created_at_idx on public.notes(created_at);

        -- Enable RLS
        alter table public.notes enable row level security;

        -- Create policies
        create policy if not exists "Users can view their own notes"
          on public.notes for select
          using (auth.uid() = user_id);

        create policy if not exists "Users can create their own notes"
          on public.notes for insert
          with check (auth.uid() = user_id);

        create policy if not exists "Users can update their own notes"
          on public.notes for update
          using (auth.uid() = user_id);

        create policy if not exists "Users can delete their own notes"
          on public.notes for delete
          using (auth.uid() = user_id);

        -- Create function to handle updated_at
        create or replace function public.handle_notes_updated_at()
        returns trigger
        language plpgsql
        as $$
        begin
          NEW.updated_at = timezone('utc'::text, now());
          return NEW;
        end;
        $$;

        -- Create trigger for updated_at
        drop trigger if exists handle_notes_updated_at on public.notes;
        create trigger handle_notes_updated_at
          before update on public.notes
          for each row
          execute function public.handle_notes_updated_at();
      `
    });

    if (createTableError) throw createTableError;
    console.log('Notes table created successfully');
  } catch (error) {
    console.error('Error creating notes table:', error);
    process.exit(1);
  }
}

createNotesTable(); 