import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { supabase } from '../../supabase';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import moment from 'moment';
import debounce from 'lodash/debounce';
import { Swipeable } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { 
  shareNoteWithFriends, 
  getSharedNotes, 
  updateNoteCollaboration,
  removeNoteCollaboration,
  getNoteCollaborators,
  canUserEditNote,
  subscribeToNoteCollaborators,
  subscribeToSharedNotes,
  ensureSharedNotesTable,
  updateSharedNote,
  type SharedNote,
  type NoteCollaborator
} from '../../utils/sharedNotes';
import CustomToast from '../../components/CustomToast';
import { useData } from '../../contexts/DataContext';

interface Note {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  isShared?: boolean;
  sharedBy?: string;
  canEdit?: boolean;
}

export default function NotesScreen() {
  const router = useRouter();
  const { data: appData } = useData();
  const [notes, setNotes] = useState<Note[]>([]);
  const [sharedNotes, setSharedNotes] = useState<SharedNote[]>([]);
  const [sharedNoteIds, setSharedNoteIds] = useState<Set<string>>(new Set());
  const [sharedNoteDetails, setSharedNoteDetails] = useState<Map<string, string[]>>(new Map());
  const [combinedNotes, setCombinedNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedNoteForSharing, setSelectedNoteForSharing] = useState<Note | null>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [showAddFriendsModal, setShowAddFriendsModal] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friendSearchTerm, setFriendSearchTerm] = useState('');
  const [isSearchingFriends, setIsSearchingFriends] = useState(false);
  const [currentNoteForSharing, setCurrentNoteForSharing] = useState<Note | null>(null);
  const [isTemporarilyClosingModal, setIsTemporarilyClosingModal] = useState(false);
  const [noteCollaborators, setNoteCollaborators] = useState<NoteCollaborator[]>([]);
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [isRealTimeUpdating, setIsRealTimeUpdating] = useState(false);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [cachedUser, setCachedUser] = useState<any>(null);
  const lastFetchRef = useRef<number>(0);

  // Memoize user
  const user = useMemo(() => cachedUser, [cachedUser]);

  // Centralized error handler
  const handleError = useCallback((error: any, context: string) => {
    console.error(`❌ ${context} error:`, error);
    if (error?.message?.includes('JWT') || error?.message?.includes('auth')) {
      Alert.alert('Authentication Error', 'Please log in again.', [
        { text: 'OK', onPress: () => router.replace('/') }
      ]);
    }
  }, [router]);

  // Combine notes only after all data is set
  const combineNotes = useCallback((notesData: Note[], sharedNotesData: SharedNote[], sharedNoteIdsData: Set<string>, sharedNoteDetailsData: Map<string, string[]>) => {
    const combined: Note[] = [...notesData];
    for (const sharedNote of sharedNotesData) {
      // Get friend's name from the joined profiles data
      const friendProfile = sharedNote.profiles;
      const sharedByName = friendProfile?.full_name || friendProfile?.username || 'Unknown User';
      
      // Get note content from the joined notes data
      const noteData = sharedNote.notes;
      const title = noteData?.title || `Shared Note from ${sharedByName}`;
      const content = noteData?.content || '';
      
      const sharedNoteItem: Note = {
        id: sharedNote.original_note_id,
        title: title,
        content: content,
        user_id: sharedNote.shared_by,
        created_at: noteData?.created_at || sharedNote.created_at,
        updated_at: noteData?.updated_at || sharedNote.updated_at,
        isShared: true,
        sharedBy: sharedByName,
        canEdit: sharedNote.can_edit,
      };
      combined.push(sharedNoteItem);
    }
    // Sort by updated_at
    combined.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    setCombinedNotes(combined);
  }, []);

  // Centralized data fetching
  const fetchAllNotesData = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const now = Date.now();
      if (!forceRefresh && now - lastFetchRef.current < 2000) return;
      lastFetchRef.current = now;
      // Get session and user
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error('No valid session');
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !currentUser) throw new Error('No user found');
      setCachedUser(currentUser);
      // Fetch all data in parallel
      const [regularNotesResult, sharedNotesResult, sharedNoteIdsResult] = await Promise.all([
        supabase
          .from('notes')
          .select('id, title, content, user_id, created_at, updated_at')
          .eq('user_id', currentUser.id)
          .order('updated_at', { ascending: false })
          .limit(50),
        getSharedNotes(),
        supabase
          .from('shared_notes')
          .select('original_note_id, shared_with')
          .eq('shared_by', currentUser.id)
      ]);
      // Set notes
      setNotes(regularNotesResult.data || []);
      // Set shared notes
      setSharedNotes(sharedNotesResult.data || []);
      // Set shared note IDs and details
      const sharedIds = new Set<string>();
      const sharedDetails = new Map<string, string[]>();
      if (sharedNoteIdsResult.data) {
        const friendIds = Array.from(new Set(sharedNoteIdsResult.data.map(item => item.shared_with)));
        let friendNameMap = new Map();
        if (friendIds.length > 0) {
          const { data: friendData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', friendIds);
          if (friendData) {
            friendNameMap = new Map(friendData.map(friend => [friend.id, friend.full_name]));
          }
        }
        sharedNoteIdsResult.data.forEach(item => {
          const noteId = item.original_note_id;
          const friendName = friendNameMap.get(item.shared_with) || 'Unknown';
          sharedIds.add(noteId);
          if (sharedDetails.has(noteId)) {
            sharedDetails.get(noteId)!.push(friendName);
          } else {
            sharedDetails.set(noteId, [friendName]);
          }
        });
      }
      setSharedNoteIds(sharedIds);
      setSharedNoteDetails(sharedDetails);
      setLastFetchTime(Date.now());
      // Combine notes after all data is set
      combineNotes(regularNotesResult.data || [], sharedNotesResult.data || [], sharedIds, sharedDetails);
    } catch (error) {
      handleError(error, 'Notes data fetch');
    } finally {
      setIsLoading(false);
    }
  }, [combineNotes, handleError]);

  // Initial setup and focus refresh
  useEffect(() => {
    ensureSharedNotesTable().catch(error => {
      console.error('❌ Failed to ensure shared notes table:', error);
    });
    fetchAllNotesData(true);
  }, [fetchAllNotesData]);
  useFocusEffect(
    useCallback(() => {
      fetchAllNotesData(true);
    }, [fetchAllNotesData])
  );

  // Real-time subscriptions (debounced refresh)
  useEffect(() => {
    if (!user?.id) return;
    const debouncedRefresh = debounce(() => {
      if (!isLoading) fetchAllNotesData(true);
    }, 1000);
    const notesSubscription = supabase
      .channel('notes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` }, debouncedRefresh)
      .subscribe();
    const sharedNotesSubscription = subscribeToSharedNotes(debouncedRefresh);
    const sharedNotesTableSubscription = supabase
      .channel('shared-notes-table-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_notes', filter: `shared_with=eq.${user.id}` }, debouncedRefresh)
      .subscribe();
    return () => {
      notesSubscription.unsubscribe();
      sharedNotesSubscription.unsubscribe();
      sharedNotesTableSubscription.unsubscribe();
      debouncedRefresh.cancel();
    };
  }, [user?.id, fetchAllNotesData, isLoading]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAllNotesData(true);
    setRefreshing(false);
  }, [fetchAllNotesData]);

  // Memoized helper function to split content
  const splitContent = useCallback((content: string) => {
    const lines = content.split('\n');
    const title = lines[0] || 'Untitled Note';
    const body = lines.slice(1).join('\n');
    return { title, body };
  }, []);

  // Optimized debounced save function with better error handling
  const debouncedSave = useCallback(
    debounce(async (content: string, note: Note | null) => {
      if (!content.trim() || !user) return;

      setIsSaving(true);
      try {
        const { title, body } = splitContent(content.trim());

        if (note) {
          // Handle both regular and shared notes the same way
          if (note.isShared) {
            // Optimistic update for shared note
            const optimisticSharedNotes = sharedNotes.map(sn =>
              sn.original_note_id === note.id
                ? { ...sn, title, content: body, updated_at: new Date().toISOString() }
                : sn
            );
            setSharedNotes(optimisticSharedNotes);
            combineNotes(notes, optimisticSharedNotes, sharedNoteIds, sharedNoteDetails);

            // Use the shared note update function
            const result = await updateSharedNote(note.id, body, title);

            if (!result.success) {
              // Revert optimistic update on error
              setSharedNotes(sharedNotes);
              combineNotes(notes, sharedNotes, sharedNoteIds, sharedNoteDetails);
              console.error('❌ [SaveNote] Failed to update shared note:', result.error);
              Alert.alert('Error', 'Failed to save shared note.');
              return;
            }
          } else {
            // Regular note update
            const optimisticNote = {
              ...note,
              title,
              content: body,
              updated_at: new Date().toISOString(),
            };

            setNotes(prevNotes => {
              const updated = prevNotes.map(n =>
                n.id === note.id ? optimisticNote : n
              ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
              combineNotes(updated, sharedNotes, sharedNoteIds, sharedNoteDetails);
              return updated;
            });

            // Update in database
            const { error } = await supabase
              .from('notes')
              .update({
                title,
                content: body,
                updated_at: optimisticNote.updated_at,
              })
              .eq('id', note.id)
              .eq('user_id', user.id);

            if (error) {
              // Revert optimistic update on error
              setNotes(prevNotes => {
                const reverted = prevNotes.map(n =>
                  n.id === note.id ? note : n
                ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
                combineNotes(reverted, sharedNotes, sharedNoteIds, sharedNoteDetails);
                return reverted;
              });
              throw error;
            }
          }
        } else {
          // Create new note with optimistic update
          const newNoteId = `temp-${Date.now()}`;
          const optimisticNote = {
            id: newNoteId,
            title,
            content: body,
            user_id: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          setNotes(prevNotes => {
            const updated = [optimisticNote, ...prevNotes];
            combineNotes(updated, sharedNotes, sharedNoteIds, sharedNoteDetails);
            return updated;
          });

          // Create in database
          const { data, error } = await supabase
            .from('notes')
            .insert({
              title,
              content: body,
              user_id: user.id,
              created_at: optimisticNote.created_at,
              updated_at: optimisticNote.updated_at,
            })
            .select()
            .single();

          if (error) {
            // Remove optimistic note on error
            setNotes(prevNotes => {
              const updated = prevNotes.filter(n => n.id !== newNoteId);
              combineNotes(updated, sharedNotes, sharedNoteIds, sharedNoteDetails);
              return updated;
            });
            throw error;
          }

          // Replace optimistic note with real one
          setNotes(prevNotes => {
            const updated = prevNotes.map(n => n.id === newNoteId ? data : n);
            combineNotes(updated, sharedNotes, sharedNoteIds, sharedNoteDetails);
            return updated;
          });
          setCurrentNote(data);
        }

        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        console.error('Error saving note:', error);
        Alert.alert('Error', 'Failed to save note');
      } finally {
        setIsSaving(false);
      }
    }, 300),
    [user, splitContent, notes, sharedNotes, sharedNoteIds, sharedNoteDetails, combineNotes]
  );

  const handleContentChange = useCallback((text: string) => {
    setNoteContent(text);
    debouncedSave(text, currentNote);
  }, [debouncedSave, currentNote]);

  const checkNoteEditPermissions = useCallback(async (noteId: string) => {
    try {
      const result = await canUserEditNote(noteId);
      return result;
    } catch (error) {
      console.error('Error checking edit permissions:', error);
      return false;
    }
  }, []);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    try {
      if (!user) {
        console.error('No cached user found');
        return;
      }

      const noteToDelete = notes.find(note => note.id === noteId) || combinedNotes.find(note => note.id === noteId);
      const isShared = noteToDelete?.isShared;

      // Optimistic delete - remove from UI immediately
      if (isShared) {
        setSharedNotes(prev => prev.filter(sn => sn.original_note_id !== noteId));
        setSharedNoteIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(noteId);
          return newSet;
        });
        setSharedNoteDetails(prev => {
          const newMap = new Map(prev);
          newMap.delete(noteId);
          return newMap;
        });
      } else {
        setNotes(prevNotes => prevNotes.filter(note => note.id !== noteId));
      }
      combineNotes(
        isShared ? notes : notes.filter(note => note.id !== noteId),
        isShared ? sharedNotes.filter(sn => sn.original_note_id !== noteId) : sharedNotes,
        isShared ? (() => { const s = new Set(sharedNoteIds); s.delete(noteId); return s; })() : sharedNoteIds,
        isShared ? (() => { const m = new Map(sharedNoteDetails); m.delete(noteId); return m; })() : sharedNoteDetails
      );

      if (currentNote?.id === noteId) {
        setShowNoteModal(false);
        setCurrentNote(null);
        setNoteContent('');
      }

      let error = null;
      if (isShared) {
        // Remove collaboration for this user
        const { error: sharedError } = await supabase
          .from('shared_notes')
          .delete()
          .eq('original_note_id', noteId)
          .eq('shared_with', user.id);
        error = sharedError;
      } else {
        // Delete from database
        const { error: notesError } = await supabase
          .from('notes')
          .delete()
          .eq('id', noteId)
          .eq('user_id', user.id);
        error = notesError;
      }

      if (error) {
        // Revert optimistic delete on error
        if (noteToDelete) {
          if (isShared) {
            setSharedNotes(prev => [
              {
                id: `temp-shared-${Date.now()}`,
                original_note_id: noteId,
                shared_by: noteToDelete.user_id,
                shared_with: user.id,
                can_edit: true,
                created_at: noteToDelete.created_at,
                updated_at: noteToDelete.updated_at,
                title: noteToDelete.title,
                content: noteToDelete.content,
              },
              ...prev
            ]);
            setSharedNoteIds(prev => new Set([...prev, noteId]));
            setSharedNoteDetails(prev => {
              const newMap = new Map(prev);
              newMap.set(noteId, [user.id]);
              return newMap;
            });
          } else {
            setNotes(prevNotes => [...prevNotes, noteToDelete].sort((a, b) => 
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
            ));
          }
          combineNotes(notes, sharedNotes, sharedNoteIds, sharedNoteDetails);
        }
        Alert.alert('Error', error.message || 'Failed to delete note');
        throw error;
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      Alert.alert('Error', 'Failed to delete note');
    }
  }, [user, notes, sharedNotes, sharedNoteIds, sharedNoteDetails, currentNote, combineNotes]);

  const handleOpenNote = useCallback(async (note: Note) => {
    setCurrentNote(note);
    setNoteContent(note.title !== 'Untitled Note' ? note.title + '\n' + note.content : note.content);
    setShowNoteModal(true);
    setIsEditing(true); // Always allow editing for all notes, including shared ones
  }, []);

  const handleNewNote = useCallback(() => {
    setCurrentNote(null);
    setNoteContent('');
    setShowNoteModal(true);
    setIsEditing(true);
  }, []);

  const handleCloseNote = useCallback(() => {
    setShowNoteModal(false);
    setIsEditing(false);
  }, []);

  const handleModalClose = useCallback(() => {
    setCurrentNote(null);
    setNoteContent('');
    setIsEditing(false);
  }, []);

  const handleStartEditing = useCallback(() => {
    // Always allow editing for all notes, including shared ones
    setIsEditing(true);
  }, []);







  // Helper function to get the first non-empty line from note content
  const getFirstNonEmptyLine = (content: string): string => {
    if (!content) return '';
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.length > 0) {
        return trimmedLine;
      }
    }
    return '';
  };

  // Memoized note item renderer for better performance
  const renderNoteItem = useCallback(({ item: note }: { item: Note }) => {
    // Debug logging for shared notes
    if (sharedNoteIds.has(note.id)) {
      console.log('🔍 [RenderNoteItem] Note is shared:', note.id);
      console.log('🔍 [RenderNoteItem] Shared details:', sharedNoteDetails.get(note.id));
      console.log('🔍 [RenderNoteItem] Note isShared property:', note.isShared);
      console.log('🔍 [RenderNoteItem] Should show "Shared with":', sharedNoteIds.has(note.id) && !note.isShared);
    }

    const renderRightActions = () => {
      return (
        <View style={styles.rightActions}>
          {/* Only show share button for notes that the user owns */}
          {!note.isShared && (
            <TouchableOpacity
              style={styles.shareAction}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                handleShareNote(note);
              }}
            >
              <Ionicons name="share-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}
          {/* Only show delete button for notes that the user owns */}
          {!note.isShared && (
            <TouchableOpacity
              style={styles.deleteAction}
              onPress={() => {
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
                Alert.alert(
                  'Delete Note',
                  'Are you sure you want to delete this note?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => handleDeleteNote(note.id),
                    },
                  ]
                );
              }}
            >
              <Ionicons name="trash" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      );
    };

    return (
      <Swipeable
        key={note.id}
        renderRightActions={renderRightActions}
        rightThreshold={40}
      >
        <TouchableOpacity
          style={styles.noteItem}
          onPress={() => handleOpenNote(note)}
          onLongPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            // Only allow deletion for notes that the user owns
            if (!note.isShared) {
              Alert.alert(
                'Delete Note',
                'Are you sure you want to delete this note?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => handleDeleteNote(note.id),
                  },
                ]
              );
            } else {
              Alert.alert(
                'Shared Note',
                'This is a shared note. You cannot delete notes shared with you.',
                [{ text: 'OK', style: 'default' }]
              );
            }
          }}
          delayLongPress={500}
        >
          <View style={styles.noteContent}>
            <View style={styles.noteHeader}>
              <Text style={styles.notePreviewTitle} numberOfLines={1}>
                {note.title}
              </Text>
            </View>
            {note.content ? (
              <Text style={styles.notePreviewContent} numberOfLines={1}>
                {getFirstNonEmptyLine(note.content)}
              </Text>
            ) : null}
            {note.isShared && (
              <View style={styles.sharedWithContainer}>
                <Text style={styles.sharedWithText}>
                  Shared by {note.sharedBy}
                </Text>
              </View>
            )}
            {sharedNoteIds.has(note.id) && !note.isShared && (
              <View style={styles.sharedWithContainer}>
                <Text style={styles.sharedWithText}>
                  Shared with: {sharedNoteDetails.get(note.id)?.join(', ') || 'Unknown'}
                </Text>
              </View>
            )}
            <Text style={styles.noteDate}>
              {moment(note.updated_at).fromNow()}
            </Text>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  }, [handleDeleteNote, handleOpenNote, sharedNoteIds, sharedNoteDetails]);

  // Debug function to test shared notes functionality
  const debugSharedNotes = useCallback(async () => {
    try {
      console.log('🔍 [DebugSharedNotes] Starting debug...');
      
      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('❌ [DebugSharedNotes] Auth issue:', authError);
        return;
      }
      
      console.log('✅ [DebugSharedNotes] User:', user.id);
      
      // Check if shared_notes table exists
      const { data: tableData, error: tableError } = await supabase
        .from('shared_notes')
        .select('*')
        .limit(5);
      
      console.log('🔍 [DebugSharedNotes] Table check result:', { data: tableData, error: tableError });
      
      // Check for shared notes where user is recipient
      const { data: receivedNotes, error: receivedError } = await supabase
        .from('shared_notes')
        .select('*')
        .eq('shared_with', user.id);
      
      console.log('🔍 [DebugSharedNotes] Received notes:', { data: receivedNotes, error: receivedError });
      
      // Check for shared notes where user is sender
      const { data: sentNotes, error: sentError } = await supabase
        .from('shared_notes')
        .select('*')
        .eq('shared_by', user.id);
      
      console.log('🔍 [DebugSharedNotes] Sent notes:', { data: sentNotes, error: sentError });
      
      // Check notes table
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('id, title')
        .eq('user_id', user.id)
        .limit(5);
      
      console.log('🔍 [DebugSharedNotes] User notes:', { data: notesData, error: notesError });
      
      // Test edit permissions for received notes
      if (receivedNotes && receivedNotes.length > 0) {
        console.log('🔍 [DebugSharedNotes] Testing edit permissions...');
        for (const sharedNote of receivedNotes) {
          const canEdit = await checkNoteEditPermissions(sharedNote.original_note_id);
          console.log(`🔍 [DebugSharedNotes] Note ${sharedNote.original_note_id}: canEdit = ${canEdit}`);
        }
      }
      
    } catch (error) {
      console.error('❌ [DebugSharedNotes] Error:', error);
    }
  }, [checkNoteEditPermissions]);





  const loadFriends = useCallback(async () => {
    try {
      setIsLoadingFriends(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('friendships')
        .select(`
          friend_id,
          profiles!friendships_friend_id_fkey(
            id,
            full_name,
            username,
            avatar_url
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (error) {
        console.error('Error loading friends:', error);
        return;
      }

      const friendsList = data
        .map(item => ({
          id: item.friend_id,
          name: (item.profiles as any)?.full_name || 'Unknown',
          username: (item.profiles as any)?.username || 'unknown',
          avatar: (item.profiles as any)?.avatar_url || null
        }))
        .filter(friend => friend.name !== 'Unknown');

      console.log('Loaded friends:', friendsList);
      setFriends(friendsList);
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setIsLoadingFriends(false);
    }
  }, []);

  const handleShareNote = useCallback((note: Note) => {
    setSelectedNoteForSharing(note);
    setSelectedFriends(new Set());
    setSearchTerm('');
    loadFriends();
    setShowShareModal(true);
  }, [loadFriends]);

  const handleFriendSelection = useCallback((friendId: string) => {
    console.log('handleFriendSelection called with:', friendId);
    setSelectedFriends(prev => {
      const newSet = new Set(prev);
      if (newSet.has(friendId)) {
        newSet.delete(friendId);
        console.log('Removed friend:', friendId);
      } else {
        newSet.add(friendId);
        console.log('Added friend:', friendId);
      }
      return newSet;
    });
  }, []);

  const handleShareNoteWithFriends = useCallback(async () => {
    console.log('🔍 [HandleShareNote] Starting share process...');
    console.log('🔍 [HandleShareNote] Selected note:', selectedNoteForSharing);
    console.log('🔍 [HandleShareNote] Selected friends:', selectedFriends);
    console.log('🔍 [HandleShareNote] Selected friends array:', Array.from(selectedFriends));
    
    if (!selectedNoteForSharing || selectedFriends.size === 0) {
      console.log('❌ [HandleShareNote] Missing note or no friends selected');
      return;
    }

    try {
      console.log('🔍 [HandleShareNote] Calling shareNoteWithFriends...');
      const result = await shareNoteWithFriends(
        selectedNoteForSharing.id,
        Array.from(selectedFriends),
        true // canEdit
      );

      console.log('🔍 [HandleShareNote] Share result:', result);

      if (result.success) {
        console.log('✅ [HandleShareNote] Share successful, updating UI...');
        setShowShareModal(false);
        setSelectedNoteForSharing(null);
        setSelectedFriends(new Set());
        
        // Optimistically update the UI immediately
        if (selectedNoteForSharing) {
          const friendNames = Array.from(selectedFriends).map(friendId => {
            const friend = friends.find(f => f.id === friendId);
            return friend?.name || 'Unknown';
          });
          
          console.log('🔍 [HandleShareNote] Optimistic update - Note ID:', selectedNoteForSharing.id);
          console.log('🔍 [HandleShareNote] Optimistic update - Friend names:', friendNames);
          
          // Update shared note IDs and details optimistically
          setSharedNoteIds(prev => {
            const newSet = new Set([...prev, selectedNoteForSharing.id]);
            console.log('🔍 [HandleShareNote] Updated shared note IDs:', Array.from(newSet));
            return newSet;
          });
          setSharedNoteDetails(prev => {
            const newMap = new Map(prev);
            newMap.set(selectedNoteForSharing.id, friendNames);
            console.log('🔍 [HandleShareNote] Updated shared note details:', Array.from(newMap.entries()));
            return newMap;
          });
          // Optimistically add to sharedNotes
          setSharedNotes(prev => {
            const alreadyExists = prev.some(sn => sn.original_note_id === selectedNoteForSharing.id);
            if (alreadyExists) return prev;
            const newSharedNote = {
              id: `temp-shared-${Date.now()}`,
              original_note_id: selectedNoteForSharing.id,
              shared_by: user.id,
              shared_with: Array.from(selectedFriends)[0], // Just for display, not used in combineNotes
              can_edit: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              // Optionally add title/content for combineNotes
              title: selectedNoteForSharing.title,
              content: selectedNoteForSharing.content,
            };
            const updated = [newSharedNote, ...prev];
            combineNotes(notes, updated, new Set([...sharedNoteIds, selectedNoteForSharing.id]), new Map([...sharedNoteDetails, [selectedNoteForSharing.id, friendNames]]));
            return updated;
          });
        }
        
        // Refresh the combined notes to ensure UI updates immediately
        // await fetchAllNotesData(); // Use fetchAllNotesData to update combinedNotes
        
        Alert.alert('Success', 'Note shared successfully!');
      } else {
        console.error('❌ [HandleShareNote] Share failed:', result.error);
        Alert.alert('Error', result.error || 'Failed to share note');
      }
    } catch (error) {
      console.error('❌ [HandleShareNote] Unexpected error:', error);
      Alert.alert('Error', 'Failed to share note');
    }
  }, [selectedNoteForSharing, selectedFriends, friends, fetchAllNotesData, combineNotes, notes, sharedNoteIds, sharedNoteDetails, user]);

  // Add friends functions
  const searchUsers = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearchingFriends(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('search_users', {
        search_term: searchTerm,
        current_user_id: user.id
      });

      if (error) {
        console.error('Error searching users:', error);
        return;
      }

      setSearchResults(data || []);
    } catch (error) {
      console.error('Error in searchUsers:', error);
    } finally {
      setIsSearchingFriends(false);
    }
  }, []);

  const sendFriendRequest = useCallback(async (friendId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('friendships')
        .insert({
          user_id: user.id,
          friend_id: friendId,
          status: 'pending'
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          Alert.alert('Error', 'Friend request already sent or friendship already exists.');
        } else {
          throw error;
        }
        return;
      }

      Alert.alert('Success', 'Friend request sent!');
      // Close add friends modal and reopen note modal
      setShowAddFriendsModal(false);
      setShowNoteModal(true);
      // Refresh search results to update the UI
      await searchUsers(friendSearchTerm);
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request. Please try again.');
    }
  }, [friendSearchTerm, searchUsers]);

  const handleFriendSearch = useCallback((text: string) => {
    setFriendSearchTerm(text);
    if (text.trim()) {
      searchUsers(text);
    } else {
      setSearchResults([]);
    }
  }, [searchUsers]);



  // Collaboration functions
  const updateCollaborationStatus = useCallback(async (noteId: string, content: string) => {
    try {
      await updateNoteCollaboration(noteId, content);
    } catch (error) {
      console.error('Error updating collaboration status:', error);
    }
  }, []);

  const loadNoteCollaborators = useCallback(async (noteId: string) => {
    try {
      const result = await getNoteCollaborators(noteId);
      if (result.success && result.data) {
        setNoteCollaborators(result.data);
      }
    } catch (error) {
      console.error('Error loading collaborators:', error);
    }
  }, []);



  // Memoized key extractor for FlatList
  const keyExtractor = useCallback((item: Note) => item.id, []);

  // Memoized empty state component
  const EmptyState = useMemo(() => (
    <View style={styles.emptyState}>
      <View style={styles.emptyStateContent}>
        <Text style={styles.emptyStateTitle}>No notes</Text>
        <Text style={styles.emptyStateSubtitle}>
          Create your first note
        </Text>
      </View>
    </View>
  ), []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {/* Minimal Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Notes</Text>

        </View>

        {/* Notes List - Using FlatList for better performance */}
        <GestureHandlerRootView style={{ flex: 1 }}>
            <FlatList
              data={combinedNotes}
              renderItem={renderNoteItem}
              keyExtractor={keyExtractor}
              style={styles.notesList}
              contentContainerStyle={combinedNotes.length === 0 ? styles.emptyListContainer : undefined}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#666"
                  title="Pull to refresh"
                  titleColor="#666"
                />
              }
              ListEmptyComponent={isLoading ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyStateContent}>
                    <ActivityIndicator size="large" color="#666" />
                    <Text style={styles.emptyStateSubtitle}>
                      Loading notes...
                    </Text>
                  </View>
                </View>
              ) : EmptyState}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={10}
              initialNumToRender={10}
              getItemLayout={(data, index) => ({
                length: 80, // Approximate height of each note item
                offset: 80 * index,
                index,
              })}
            />
        </GestureHandlerRootView>

        {/* Note Modal */}
        <Modal
          visible={showNoteModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleCloseNote}
          onDismiss={() => {
            // Only clear the note if we're not just temporarily closing for add friends modal
            if (!isTemporarilyClosingModal) {
              handleModalClose();
            }
            setIsTemporarilyClosingModal(false);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <SafeAreaView style={styles.modalContent}>
              {/* Minimal Modal Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={handleCloseNote}
                  style={styles.modalCancelButton}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                {isSaving && (
                  <ActivityIndicator size="small" color="#666" style={styles.savingIndicator} />
                )}
                
                {isRealTimeUpdating && (
                  <View style={styles.realTimeUpdateIndicator}>
                    <ActivityIndicator size="small" color="#00ACC1" />
                    <Text style={styles.realTimeUpdateText}>Updating...</Text>
                  </View>
                )}
                
                <View style={styles.modalRightButtons}>
                  {/* Only show share button for notes that the user owns */}
                  {currentNote && !currentNote.isShared && (
                    <TouchableOpacity
                      onPress={() => {
                        console.log('Add Friends button pressed!');
                        console.log('Current note being set for sharing:', currentNote);
                        console.log('Current note ID:', currentNote?.id);
                        console.log('Current note title:', currentNote?.title);
                        
                        // Allow sharing even empty notes - if the note modal is open, we can share
                        // The note context will be created from currentNote or noteContent
                        if (!showNoteModal) {
                          Alert.alert('Error', 'No note open. Please open a note first.');
                          return;
                        }
                        
                        setIsTemporarilyClosingModal(true);
                        setCurrentNoteForSharing(currentNote);
                        setShowAddFriendsModal(true);
                        setShowNoteModal(false); // Close note modal to show add friends modal
                      }}
                      style={styles.modalAddFriendsButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="person-add-outline" size={20} color="#00ACC1" />
                    </TouchableOpacity>
                  )}

                  {/* Show different button text for shared notes */}
                  <TouchableOpacity
                    onPress={handleCloseNote}
                    style={styles.modalCloseButton}
                  >
                    <Text style={styles.modalCloseText}>
                      {currentNote?.isShared ? 'Done' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Shared Note Indicator */}
              {currentNote?.isShared && (
                <View style={styles.sharedNoteIndicator}>
                  <Ionicons name="people" size={16} color="#00ACC1" />
                  <Text style={styles.sharedNoteText}>
                    Shared by {currentNote.sharedBy}
                  </Text>
                </View>
              )}

              {/* Note Editor */}
              {isEditing ? (
                <TextInput
                  style={styles.noteEditor}
                  placeholder="Start writing..."
                  value={noteContent}
                  onChangeText={handleContentChange}
                  multiline
                  textAlignVertical="top"
                  autoFocus
                  editable={true}
                />
              ) : (
                <TouchableOpacity
                  style={styles.noteEditorContainer}
                  onPress={handleStartEditing}
                  activeOpacity={0.8}
                >
                  <View style={styles.noteEditorPlaceholder}>
                    {noteContent ? (
                      <Text style={styles.noteEditorContent}>
                        {noteContent}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              )}
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>

        {/* Share Modal */}
        <Modal
          visible={showShareModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowShareModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setShowShareModal(false)}
                style={styles.modalCancelButton}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <Text style={styles.modalTitle}>Share Note</Text>
              
              <TouchableOpacity
                onPress={handleShareNoteWithFriends}
                style={[
                  styles.modalCloseButton,
                  { opacity: selectedFriends.size === 0 ? 0.5 : 1 }
                ]}
                disabled={selectedFriends.size === 0}
              >
                <Text style={styles.modalCloseText}>Share</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.shareModalContent}>
                <Text style={styles.shareModalSubtitle}>
                  Select friends to share "{selectedNoteForSharing?.title || 'Untitled Note'}" with:
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>
                  {friends.length} friends available, {selectedFriends.size} selected
                </Text>
                
                <TextInput
                  placeholder="Search friends..."
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  style={styles.searchInput}
                  placeholderTextColor="#999"
                />

                {isLoadingFriends ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#666" />
                    <Text style={styles.loadingText}>Loading friends...</Text>
                  </View>
                ) : (
                  <FlatList
                    data={friends.filter(friend =>
                      friend.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      friend.username.toLowerCase().includes(searchTerm.toLowerCase())
                    )}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item: friend }) => (
                      <TouchableOpacity
                        style={styles.friendItem}
                        onPress={() => {
                          console.log('Friend tapped:', friend.id, friend.name);
                          handleFriendSelection(friend.id);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.friendInfo}>
                          {friend.avatar ? (
                            <Image source={{ uri: friend.avatar }} style={styles.friendAvatar} />
                          ) : (
                            <View style={styles.friendAvatarPlaceholder}>
                              <Ionicons name="person" size={16} color="#fff" />
                            </View>
                          )}
                          <View style={styles.friendDetails}>
                            <Text style={styles.friendName}>{friend.name}</Text>
                            <Text style={styles.friendUsername}>@{friend.username}</Text>
                          </View>
                        </View>
                        <View style={[
                          styles.selectionIndicator,
                          selectedFriends.has(friend.id) && styles.selectionIndicatorSelected
                        ]}>
                          {selectedFriends.has(friend.id) ? (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                          ) : (
                            <View style={{ width: 16, height: 16 }} />
                          )}
                        </View>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>No friends found</Text>
                        <Text style={styles.emptySubtext}>
                          {searchTerm ? 'Try a different search term' : 'Add friends to share notes with them'}
                        </Text>
                      </View>
                    }
                  />
                )}
              </View>
            </View>
          </SafeAreaView>
        </Modal>

        {/* Add Friends Modal */}
        <Modal
          visible={showAddFriendsModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            console.log('Add Friends modal onRequestClose');
            setShowAddFriendsModal(false);
            setShowNoteModal(true); // Reopen note modal when add friends modal is closed
            setIsTemporarilyClosingModal(false);
            // Preserve the note context for sharing
            if (currentNoteForSharing && !currentNote) {
              setCurrentNote(currentNoteForSharing);
            }
          }}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowAddFriendsModal(false);
                  setShowNoteModal(true); // Reopen note modal when add friends modal is closed
                  setIsTemporarilyClosingModal(false);
                  // Preserve the note context for sharing
                  if (currentNoteForSharing && !currentNote) {
                    setCurrentNote(currentNoteForSharing);
                  }
                }}
                style={styles.modalCancelButton}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <Text style={styles.modalTitle}>
                {(currentNoteForSharing || currentNote) ? `Share Note: ${(currentNoteForSharing || currentNote)?.title || 'Untitled'}` : 'Add Friends'}
              </Text>
              
              <View style={{ width: 60 }} />
            </View>

            <View style={styles.modalContent}>
              <View style={styles.shareModalContent}>
                <Text style={styles.shareModalSubtitle}>
                  {(currentNoteForSharing || currentNote)
                    ? `Search for friends to share "${(currentNoteForSharing || currentNote)?.title || 'Untitled Note'}" with:`
                    : 'Search for users to add as friends:'
                  }
                </Text>
                
                <TextInput
                  placeholder="Search by name or username..."
                  value={friendSearchTerm}
                  onChangeText={handleFriendSearch}
                  style={styles.searchInput}
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                {isSearchingFriends ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#666" />
                    <Text style={styles.loadingText}>Searching...</Text>
                  </View>
                ) : (
                  <FlatList
                    data={searchResults}
                    keyExtractor={(item) => item.user_id}
                    renderItem={({ item: result }) => (
                      <TouchableOpacity
                        style={styles.friendItem}
                        onPress={async () => {
                          console.log('Friend button pressed, is_friend:', result.is_friend);
                          console.log('currentNoteForSharing:', currentNoteForSharing);
                          console.log('currentNote:', currentNote);
                          console.log('noteContent:', noteContent);
                          
                          if (result.is_friend) {
                            // Create a note object for sharing, even if it hasn't been saved yet
                            let noteToShare = currentNoteForSharing || currentNote;
                            
                            // If we don't have a saved note, create a temporary note for sharing (even if empty)
                            if (!noteToShare) {
                              const { title, body } = splitContent(noteContent || '');
                              noteToShare = {
                                id: `temp-share-${Date.now()}`,
                                title: title || 'Untitled Note',
                                content: body || '',
                                user_id: cachedUser?.id || '',
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                              };
                            }
                            
                            // If we still don't have a note to share, create a minimal empty note
                            if (!noteToShare) {
                              noteToShare = {
                                id: `temp-share-${Date.now()}`,
                                title: 'Untitled Note',
                                content: '',
                                user_id: cachedUser?.id || '',
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                              };
                            }
                            
                            console.log('Final noteToShare:', noteToShare);
                            
                            if (noteToShare && noteToShare.id) {
                              console.log('Sharing note with friend:', result.user_id);
                              
                              // If this is a temporary note (not saved yet), save it first
                              if (noteToShare.id.startsWith('temp-share-')) {
                                try {
                                                                     const { title, body } = splitContent(noteContent || '');
                                  const { data: savedNote, error: saveError } = await supabase
                                    .from('notes')
                                                                         .insert({
                                       title: title || 'Untitled Note',
                                       content: body || '',
                                       user_id: cachedUser?.id,
                                       created_at: new Date().toISOString(),
                                       updated_at: new Date().toISOString(),
                                     })
                                    .select()
                                    .single();

                                  if (saveError) {
                                    console.error('Error saving note before sharing:', saveError);
                                    Alert.alert('Error', 'Failed to save note before sharing');
                                    return;
                                  }

                                  noteToShare = savedNote;
                                  // Update the current note with the saved version
                                  setCurrentNote(savedNote);
                                  setNotes(prevNotes => [savedNote, ...prevNotes]);
                                } catch (error) {
                                  console.error('Error saving note before sharing:', error);
                                  Alert.alert('Error', 'Failed to save note before sharing');
                                  return;
                                }
                              }

                              try {
                                if (!noteToShare) {
                                  Alert.alert('Error', 'Failed to prepare note for sharing');
                                  return;
                                }
                                
                                const result_share = await shareNoteWithFriends(
                                  noteToShare.id,
                                  [result.user_id],
                                  true // canEdit
                                );

                                if (result_share.success) {
                                  Alert.alert('Success', `Note shared with ${result.full_name}!`);
                                  // Close add friends modal and reopen note modal
                                  setShowAddFriendsModal(false);
                                  setShowNoteModal(true);
                                  setCurrentNoteForSharing(null); // Clear only after successful share
                                } else {
                                  Alert.alert('Error', result_share.error || 'Failed to share note');
                                }
                              } catch (error) {
                                console.error('Error sharing note:', error);
                                Alert.alert('Error', 'Failed to share note');
                              }
                                                          } else {
                                console.error('No valid note to share:', { currentNoteForSharing, currentNote, noteContent });
                                Alert.alert('Error', 'Failed to prepare note for sharing. Please try again.');
                              }
                          } else {
                            sendFriendRequest(result.user_id);
                          }
                        }}
                        disabled={false}
                      >
                        <View style={styles.friendInfo}>
                          {result.avatar_url ? (
                            <Image source={{ uri: result.avatar_url }} style={styles.friendAvatar} />
                          ) : (
                            <View style={styles.friendAvatarPlaceholder}>
                              <Ionicons name="person" size={16} color="#fff" />
                            </View>
                          )}
                          <View style={styles.friendDetails}>
                            <Text style={styles.friendName}>{result.full_name}</Text>
                            <Text style={styles.friendUsername}>@{result.username || 'no-username'}</Text>
                          </View>
                        </View>
                        <View style={[
                          styles.actionButton,
                          result.is_friend 
                            ? { backgroundColor: '#34C759' }
                            : { backgroundColor: '#00ACC1' }
                        ]}>
                          <Ionicons 
                            name={result.is_friend ? "checkmark" : "person-add"} 
                            size={16} 
                            color="#fff" 
                          />
                        </View>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={styles.emptyContainer}>
                        <Ionicons name="search-outline" size={64} color="#ccc" />
                        <Text style={styles.emptyText}>
                          {friendSearchTerm ? 'No users found' : 'Search for friends'}
                        </Text>
                        <Text style={styles.emptySubtext}>
                          {friendSearchTerm ? 'Try a different search term' : 'Enter a name or username to find people to connect with'}
                        </Text>
                      </View>
                    }
                  />
                )}
              </View>
            </View>
          </SafeAreaView>
        </Modal>

        {/* Floating Add Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleNewNote}
        >
          <Ionicons name="add" size={22} color="white" />
        </TouchableOpacity>

        {/* Real-time Update Toast */}
        {showUpdateToast && (
          <CustomToast text1="Note updated by collaborator" />
        )}

      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingTop: 12,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ff3b30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: 'Onest',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Onest',
  },


  pendingNoteItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pendingNoteContent: {
    marginBottom: 12,
  },
  pendingNoteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
    fontFamily: 'Onest',
  },
  pendingNoteDate: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Onest',
  },

  addButton: {
    position: 'absolute',
    right: 24,
    bottom: 100,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#00ACC1',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  notesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loader: {
    marginTop: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
    fontFamily: 'Onest',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Onest',
  },
  noteItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  noteContent: {
    flex: 1,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sharedIndicator: {
    marginLeft: 8,
  },
  pendingIndicator: {
    marginLeft: 8,
  },
  sharedWithContainer: {
    marginBottom: 4,
  },
  sharedWithText: {
    fontSize: 12,
    color: '#00ACC1',
    fontFamily: 'Onest',
    fontStyle: 'italic',
  },
  notePreviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 0,
    fontFamily: 'Onest',
  },
  notePreviewContent: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    marginBottom: 8,
    fontFamily: 'Onest',
  },
  noteDate: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'Onest',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    fontFamily: 'Onest',
  },
  modalRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalAddFriendsButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
  },

  modalCloseButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Onest',
  },
  savingIndicator: {
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -10 }],
  },
  realTimeUpdateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -40 }],
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  realTimeUpdateText: {
    fontSize: 12,
    color: '#00ACC1',
    marginLeft: 4,
    fontFamily: 'Onest',
    fontWeight: '500',
  },
  noteEditor: {
    flex: 1,
    fontSize: 18,
    color: '#000',
    lineHeight: 26,
    padding: 20,
    textAlignVertical: 'top',
    fontFamily: 'Onest',
  },
  rightActions: {
    flexDirection: 'row',
    height: '100%',
  },
  shareAction: {
    backgroundColor: '#00ACC1',
    width: 60,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAction: {
    backgroundColor: '#ff3b30',
    width: 60,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteEditorContainer: {
    flex: 1,
    padding: 20,
  },
  noteEditorPlaceholder: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  noteEditorContent: {
    fontSize: 18,
    color: '#000',
    lineHeight: 26,
    fontFamily: 'Onest',
    flex: 1,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingBottom: 120,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Onest',
  },
  shareModalContent: {
    flex: 1,
    padding: 20,
  },
  shareModalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    fontFamily: 'Onest',
  },
  searchInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 20,
    fontFamily: 'Onest',
    color: '#333',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    fontFamily: 'Onest',
  },
  loadingProgress: {
    marginTop: 20,
    alignItems: 'center',
  },
  loadingProgressText: {
    fontSize: 14,
    color: '#999',
    marginVertical: 2,
    fontFamily: 'Onest',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 60,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  friendAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Onest',
  },
  friendUsername: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Onest',
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionIndicatorSelected: {
    backgroundColor: '#00ACC1',
    borderColor: '#00ACC1',
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    fontFamily: 'Onest',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Onest',
  },
  sharedNoteIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#f0f8ff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sharedNoteText: {
    fontSize: 14,
    color: '#00ACC1',
    marginLeft: 8,
    fontFamily: 'Onest',
  },
  noteEditorDisabled: {
    backgroundColor: '#f8f9fa',
    color: '#999',
  },
}); 