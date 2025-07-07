import { supabase } from '../supabase';

// Types
export interface SharedNote {
  id: string;
  original_note_id: string;
  note_title: string;
  note_content: string;
  shared_by: string;
  shared_by_name: string;
  shared_at: string;
  can_edit: boolean;
  shared_with: string[];
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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Get the note details
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .eq('user_id', user.id)
      .single();

    if (noteError || !note) {
      return { success: false, error: 'Note not found' };
    }

    // Create shared note entries
    const sharedNoteData = friendIds.map(friendId => ({
      original_note_id: noteId,
      note_title: note.title,
      note_content: note.content,
      shared_by: user.id,
      shared_by_name: user.user_metadata?.full_name || user.email || 'Unknown',
      shared_at: new Date().toISOString(),
      can_edit: canEdit,
      shared_with: [friendId]
    }));

    const { error: insertError } = await supabase
      .from('shared_notes')
      .insert(sharedNoteData);

    if (insertError) {
      console.error('Error sharing note:', insertError);
      return { success: false, error: 'Failed to share note' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in shareNote:', error);
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

    const { data, error } = await supabase
      .from('shared_notes')
      .select('*')
      .contains('shared_with', [user.id]);

    if (error) {
      console.error('Error fetching shared notes:', error);
      return { success: false, error: 'Failed to fetch shared notes' };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Error in getSharedNotes:', error);
    return { success: false, error: 'Unexpected error occurred' };
  }
};

export const getSharedNoteIds = async (): Promise<Set<string>> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Set();
    }

    const { data, error } = await supabase
      .from('shared_notes')
      .select('original_note_id')
      .contains('shared_with', [user.id]);

    if (error) {
      console.error('Error fetching shared note IDs:', error);
      return new Set();
    }

    return new Set(data?.map(item => item.original_note_id) || []);
  } catch (error) {
    console.error('Error in getSharedNoteIds:', error);
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
          shared_at: sharedNote.shared_at
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
      .contains('shared_with', [user.id])
      .eq('can_edit', true)
      .single();

    if (checkError || !sharedNote) {
      return { success: false, error: 'No edit permission for this note' };
    }

    // Update the shared note content
    const updateData: any = { note_content: content };
    if (title) {
      updateData.note_title = title;
    }

    const { error: updateError } = await supabase
      .from('shared_notes')
      .update(updateData)
      .eq('original_note_id', noteId)
      .contains('shared_with', [user.id]);

    if (updateError) {
      console.error('Error updating shared note:', updateError);
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

    // Get current shared_with array and remove the user
    const { data: currentNote, error: fetchError } = await supabase
      .from('shared_notes')
      .select('shared_with')
      .eq('original_note_id', noteId)
      .eq('shared_by', user.id)
      .single();

    if (fetchError || !currentNote) {
      return { success: false, error: 'Note not found' };
    }

    const updatedSharedWith = currentNote.shared_with.filter((id: string) => id !== userId);

    const { error: updateError } = await supabase
      .from('shared_notes')
      .update({
        shared_with: updatedSharedWith
      })
      .eq('original_note_id', noteId)
      .eq('shared_by', user.id);

    if (updateError) {
      console.error('Error removing collaboration:', updateError);
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
      .contains('shared_with', [user.id])
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