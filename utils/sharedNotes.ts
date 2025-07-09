import { supabase } from '../supabase';

// Types
export interface SharedNote {
  id: string;
  original_note_id: string;
  shared_by: string;
  shared_with: string;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}

export interface NoteCollaborator {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  can_edit: boolean;
  shared_at: string;
}

// Functions
export const shareNote = async (
  noteId: string,
  friendIds: string[],
  canEdit: boolean = false
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('🔍 [ShareNote] Starting to share note:', { noteId, friendIds, canEdit });
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('❌ [ShareNote] User not authenticated:', userError);
      return { success: false, error: 'User not authenticated' };
    }

    console.log('🔍 [ShareNote] Current user:', user.id);

    // Get the note details
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .eq('user_id', user.id)
      .single();

    if (noteError || !note) {
      console.error('❌ [ShareNote] Note not found:', noteError);
      return { success: false, error: 'Note not found' };
    }

    console.log('🔍 [ShareNote] Found note:', note);

    // Create shared note entries - one for each friend
    const sharedNoteData = friendIds.map(friendId => ({
      original_note_id: noteId,
      shared_by: user.id,
      shared_with: friendId,
      can_edit: canEdit
    }));

    console.log('🔍 [ShareNote] Creating shared note entries:', sharedNoteData);

    // Try to insert shared notes
    const { error: insertError } = await supabase
      .from('shared_notes')
      .insert(sharedNoteData);

    if (insertError) {
      console.error('❌ [ShareNote] Error sharing note:', insertError);
      
      // If the error is about the table not existing, try to create it
      if (insertError.message && insertError.message.includes('relation "shared_notes" does not exist')) {
        console.log('🔨 [ShareNote] Table does not exist, attempting to create it...');
        
        // Try to create the table using a simple approach
        const createTableResult = await ensureSharedNotesTable();
        if (createTableResult.success) {
          // Try the insert again
          const { error: retryError } = await supabase
            .from('shared_notes')
            .insert(sharedNoteData);
            
          if (retryError) {
            console.error('❌ [ShareNote] Error after creating table:', retryError);
            return { success: false, error: 'Failed to share note after creating table' };
          }
          
          console.log('✅ [ShareNote] Successfully shared note after creating table');
          return { success: true };
        } else {
          return { success: false, error: 'Failed to create shared notes table' };
        }
      }
      
      return { success: false, error: 'Failed to share note' };
    }

    console.log('✅ [ShareNote] Successfully shared note with friends');
    return { success: true };
  } catch (error) {
    console.error('❌ [ShareNote] Unexpected error:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
};

// Alias for shareNote to match the import
export const shareNoteWithFriends = shareNote;

export const getSharedNotes = async (): Promise<{ success: boolean; data?: SharedNote[]; error?: string }> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    console.log('🔍 [SharedNotes] Fetching shared notes for user:', user.id);

    const { data, error } = await supabase
      .from('shared_notes')
      .select('*')
      .eq('shared_with', user.id);

    if (error) {
      console.error('Error fetching shared notes:', error);
      return { success: false, error: 'Failed to fetch shared notes' };
    }

    console.log('🔍 [SharedNotes] Found shared notes:', data?.length || 0, data);

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error in getSharedNotes:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
};

export const getSharedNoteIds = async (): Promise<Set<string>> => {
  try {
    console.log('🔍 [GetSharedNoteIds] Starting to fetch shared note IDs...');
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('❌ [GetSharedNoteIds] User not authenticated');
      return new Set();
    }

    console.log('🔍 [GetSharedNoteIds] Current user:', user.id);

    const { data, error } = await supabase
      .from('shared_notes')
      .select('original_note_id')
      .eq('shared_with', user.id);

    if (error) {
      console.error('❌ [GetSharedNoteIds] Error fetching shared note IDs:', error);
      return new Set();
    }

    console.log('🔍 [GetSharedNoteIds] Raw data from shared_notes:', data);
    
    const noteIds = new Set(data?.map(item => item.original_note_id) || []);
    console.log('🔍 [GetSharedNoteIds] Final note IDs set:', Array.from(noteIds));
    
    return noteIds;
  } catch (error) {
    console.error('❌ [GetSharedNoteIds] Unexpected error:', error);
    return new Set();
  }
};

export const getNoteCollaborators = async (noteId: string): Promise<{ success: boolean; data?: NoteCollaborator[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('shared_notes')
      .select(`
        *,
        profiles:shared_with(
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('original_note_id', noteId);

    if (error) {
      console.error('Error fetching note collaborators:', error);
      return { success: false, error: 'Failed to fetch collaborators' };
    }

    const collaborators: NoteCollaborator[] = [];
    data?.forEach(sharedNote => {
      if (sharedNote.profiles) {
        collaborators.push({
          id: sharedNote.profiles.id,
          username: sharedNote.profiles.username,
          full_name: sharedNote.profiles.full_name,
          avatar_url: sharedNote.profiles.avatar_url,
          can_edit: sharedNote.can_edit,
          shared_at: sharedNote.created_at
        });
      }
    });

    return { success: true, data: collaborators };
  } catch (error) {
    console.error('Error in getNoteCollaborators:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
};

export const updateSharedNote = async (
  noteId: string,
  content: string,
  title?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Check if user has permission to edit this shared note
    const { data: sharedNote, error: checkError } = await supabase
      .from('shared_notes')
      .select('*')
      .eq('original_note_id', noteId)
      .eq('shared_with', user.id)
      .eq('can_edit', true)
      .single();

    if (checkError || !sharedNote) {
      return { success: false, error: 'No edit permission for this note' };
    }

    // Update the original note content (not the shared_notes table)
    const updateData: any = { content };
    if (title) {
      updateData.title = title;
    }

    const { error: updateError } = await supabase
      .from('notes')
      .update(updateData)
      .eq('id', noteId);

    if (updateError) {
      console.error('Error updating note:', updateError);
      return { success: false, error: 'Failed to update note' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateSharedNote:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
};

// Alias for updateSharedNote to match the import
export const updateNoteCollaboration = updateSharedNote;

export const removeNoteCollaboration = async (
  noteId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Delete the shared note record for this specific user
    const { error: deleteError } = await supabase
      .from('shared_notes')
      .delete()
      .eq('original_note_id', noteId)
      .eq('shared_by', user.id)
      .eq('shared_with', userId);

    if (deleteError) {
      console.error('Error removing collaboration:', deleteError);
      return { success: false, error: 'Failed to remove collaboration' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in removeNoteCollaboration:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
};

export const canUserEditNote = async (noteId: string): Promise<boolean> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return false;
    }

    const { data, error } = await supabase
      .from('shared_notes')
      .select('can_edit')
      .eq('original_note_id', noteId)
      .eq('shared_with', user.id) // Use eq instead of contains
      .single();

    if (error || !data) {
      return false;
    }

    return data.can_edit;
  } catch (error) {
    console.error('Error in canUserEditNote:', error);
    return false;
  }
};

export const subscribeToSharedNotes = (
  callback: (payload: any) => void
) => {
  return supabase
    .channel('shared_notes_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'shared_notes'
      },
      callback
    )
    .subscribe();
};

// Alias for subscribeToSharedNotes to match the import
export const subscribeToNoteCollaborators = subscribeToSharedNotes;



// Function to get shared note with actual content
export const getSharedNoteWithContent = async (noteId: string): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    // First check if user has access to this shared note
    const { data: sharedNote, error: accessError } = await supabase
      .from('shared_notes')
      .select('*')
      .eq('original_note_id', noteId)
      .eq('shared_with', user.id)
      .single();

    if (accessError || !sharedNote) {
      return { success: false, error: 'No access to this shared note' };
    }

    // Get the actual note content
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (noteError || !note) {
      return { success: false, error: 'Note not found' };
    }

    return { 
      success: true, 
      data: {
        ...note,
        shared_note: sharedNote
      }
    };
  } catch (error) {
    console.error('Error in getSharedNoteWithContent:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
}; 

// Add a function to ensure the shared_notes table exists
export const ensureSharedNotesTable = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('🔍 [EnsureSharedNotesTable] Checking if shared_notes table exists...');
    
    // Try to query the shared_notes table to see if it exists
    const { data, error } = await supabase
      .from('shared_notes')
      .select('count')
      .limit(1);

    if (error) {
      if (error.code === '42P01') {
        // Table doesn't exist, but we can't create it from the client
        console.log('⚠️ [EnsureSharedNotesTable] shared_notes table does not exist');
        console.log('⚠️ [EnsureSharedNotesTable] Please run the SQL script in your Supabase dashboard');
        return { success: false, error: 'Table does not exist - run SQL script in dashboard' };
      } else {
        console.error('❌ [EnsureSharedNotesTable] Error checking table:', error);
        return { success: false, error: 'Failed to check table existence' };
      }
    }

    console.log('✅ [EnsureSharedNotesTable] shared_notes table exists and is accessible');
    return { success: true };
  } catch (error) {
    console.error('❌ [EnsureSharedNotesTable] Unexpected error:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
}; 