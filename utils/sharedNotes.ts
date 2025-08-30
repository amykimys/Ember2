import { supabase } from '../supabase';
import { sendNoteSharedNotification } from './notificationUtils';

// Types
export interface SharedNote {
  id: string;
  original_note_id: string;
  shared_by: string;
  shared_with: string;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    full_name: string;
    username: string;
    avatar_url?: string;
  };
  notes?: {
    id: string;
    title: string;
    content: string;
    user_id: string;
    created_at: string;
    updated_at: string;
  };
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
  canEdit: boolean = true // Always true for automatic editing
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

    // Create shared note entries - one for each friend (always with edit permissions)
    const sharedNoteData = friendIds.map(friendId => ({
      original_note_id: noteId,
      shared_by: user.id,
      shared_with: friendId,
      can_edit: true // Always allow editing for shared notes
    }));

    console.log('🔍 [ShareNote] Creating shared note entries:', sharedNoteData);

    // Try to insert shared notes
    const { error: insertError } = await supabase
      .from('shared_notes')
      .insert(sharedNoteData);

    if (insertError) {
      console.error('❌ [ShareNote] Error inserting shared notes:', insertError);
      return { success: false, error: insertError.message };
    }

    console.log('✅ [ShareNote] Shared notes created successfully');

    // Send notifications to all friends
    for (const friendId of friendIds) {
      try {
        await sendNoteSharedNotification(
          friendId,
          user.id,
          note.title,
          noteId
        );
      } catch (notificationError) {
        console.error('Error sending notification to friend:', friendId, notificationError);
        // Don't fail the entire operation if notification fails
      }
    }

    return { success: true };
  } catch (error) {
    console.error('❌ [ShareNote] Unexpected error:', error);
    return { success: false, error: 'Failed to share note' };
  }
};

// Alias for shareNote to match the import
export const shareNoteWithFriends = shareNote;

export const getSharedNotes = async (): Promise<{ success: boolean; data?: SharedNote[]; error?: string }> => {
  try {
    console.log('🔍 [GetSharedNotes] Starting to fetch shared notes...');
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('❌ [GetSharedNotes] User error:', userError);
      return { success: false, error: 'User authentication error' };
    }
    if (!user) {
      console.error('❌ [GetSharedNotes] No user found');
      return { success: false, error: 'User not authenticated' };
    }

    console.log('✅ [GetSharedNotes] User authenticated:', user.id);

    // Check if shared_notes table exists and is accessible
    const { data: tableCheck, error: tableError } = await supabase
      .from('shared_notes')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('❌ [GetSharedNotes] Table access error:', tableError);
      return { success: false, error: `Table access error: ${tableError.message}` };
    }

    console.log('✅ [GetSharedNotes] Shared notes table is accessible');

    const { data, error } = await supabase
      .from('shared_notes')
      .select(`
        *,
        notes!shared_notes_original_note_id_fkey(
          id,
          title,
          content,
          user_id,
          created_at,
          updated_at
        )
      `)
      .eq('shared_with', user.id);

    if (error) {
      console.error('❌ [GetSharedNotes] Query error:', error);
      return { success: false, error: `Failed to fetch shared notes: ${error.message}` };
    }

    console.log('🔍 [GetSharedNotes] Raw query result:', data);
    console.log('✅ [GetSharedNotes] Found shared notes:', data?.length || 0);

    // Fetch friend profiles separately
    if (data && data.length > 0) {
      const friendIds = [...new Set(data.map(item => item.shared_by))];
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', friendIds);

      if (profilesError) {
        console.error('❌ [GetSharedNotes] Error fetching profiles:', profilesError);
      } else {
        // Create a map of user ID to profile
        const profileMap = new Map();
        profilesData?.forEach(profile => {
          profileMap.set(profile.id, profile);
        });

        // Attach profile data to shared notes
        data.forEach(sharedNote => {
          sharedNote.profiles = profileMap.get(sharedNote.shared_by);
        });
      }
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('❌ [GetSharedNotes] Unexpected error:', error);
    return { success: false, error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` };
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

    // Check if user has access to this shared note (either as sender or recipient)
    const { data: sharedNote, error: checkError } = await supabase
      .from('shared_notes')
      .select('*')
      .eq('original_note_id', noteId)
      .or(`shared_by.eq.${user.id},shared_with.eq.${user.id}`)
      .single();

    if (checkError || !sharedNote) {
      return { success: false, error: 'No access to this shared note' };
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

// Delete a shared note (for both sender and recipient)
export const deleteSharedNote = async (
  sharedNoteId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    // First, get the shared note details to check permissions
    const { data: sharedNote, error: fetchError } = await supabase
      .from('shared_notes')
      .select('*')
      .eq('id', sharedNoteId)
      .single();

    if (fetchError || !sharedNote) {
      console.error('Error fetching shared note:', fetchError);
      return { success: false, error: 'Shared note not found' };
    }

    // Check if user is the sender or recipient
    if (sharedNote.shared_by !== user.id && sharedNote.shared_with !== user.id) {
      return { success: false, error: 'You do not have permission to delete this shared note' };
    }

    // Delete the shared note record
    const { error: deleteError } = await supabase
      .from('shared_notes')
      .delete()
      .eq('id', sharedNoteId);

    if (deleteError) {
      console.error('Error deleting shared note:', deleteError);
      return { success: false, error: 'Failed to delete shared note' };
    }

    console.log('✅ Shared note deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('Error in deleteSharedNote:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
};

// Delete all shared notes for a specific note (for the note owner)
export const deleteAllSharedNotesForNote = async (
  noteId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Check if user owns the original note
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('user_id')
      .eq('id', noteId)
      .single();

    if (noteError || !note) {
      console.error('Error fetching note:', noteError);
      return { success: false, error: 'Note not found' };
    }

    if (note.user_id !== user.id) {
      return { success: false, error: 'You do not have permission to delete shared notes for this note' };
    }

    // Delete all shared note records for this note
    const { error: deleteError } = await supabase
      .from('shared_notes')
      .delete()
      .eq('original_note_id', noteId);

    if (deleteError) {
      console.error('Error deleting shared notes:', deleteError);
      return { success: false, error: 'Failed to delete shared notes' };
    }

    console.log('✅ All shared notes deleted successfully for note:', noteId);
    return { success: true };
  } catch (error) {
    console.error('Error in deleteAllSharedNotesForNote:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
};

export const canUserEditNote = async (noteId: string): Promise<boolean> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.log('🔍 [CanUserEditNote] User not authenticated');
      return false;
    }

    console.log('🔍 [CanUserEditNote] Checking access for note:', noteId, 'user:', user.id);

    // Check if user has access to this shared note (either as sender or recipient)
    const { data, error } = await supabase
      .from('shared_notes')
      .select('id')
      .eq('original_note_id', noteId)
      .or(`shared_by.eq.${user.id},shared_with.eq.${user.id}`)
      .single();

    if (error) {
      console.log('🔍 [CanUserEditNote] Error fetching access:', error);
      return false;
    }

    if (!data) {
      console.log('🔍 [CanUserEditNote] No shared note record found');
      return false;
    }

    console.log('🔍 [CanUserEditNote] User has access to shared note');
    return true; // Always allow editing for shared notes
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