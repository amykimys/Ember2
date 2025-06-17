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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '../../supabase';
import * as Haptics from 'expo-haptics';
import moment from 'moment';
import debounce from 'lodash/debounce';
import { Swipeable } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface Note {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export default function NotesScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [cachedUser, setCachedUser] = useState<any>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const lastFetchRef = useRef<number>(0);

  // Memoize user to prevent unnecessary re-renders
  const user = useMemo(() => cachedUser, [cachedUser]);

  // Add session check and refresh mechanism
  const checkAndRefreshSession = useCallback(async () => {
    try {
      console.log('🔐 Checking Supabase session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ Session check error:', error);
        return false;
      }

      if (!session) {
        console.log('❌ No active session found');
        return false;
      }

      // Check if session is expired or about to expire
      const now = new Date();
      const expiresAt = new Date(session.expires_at! * 1000);
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      
      console.log('📅 Session expires at:', expiresAt);
      console.log('⏰ Time until expiry:', timeUntilExpiry / 1000 / 60, 'minutes');

      // If session expires in less than 5 minutes, refresh it
      if (timeUntilExpiry < 5 * 60 * 1000) {
        console.log('🔄 Refreshing session...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.error('❌ Session refresh error:', refreshError);
          return false;
        }

        if (refreshData.session) {
          console.log('✅ Session refreshed successfully');
          return true;
        } else {
          console.log('❌ No session returned from refresh');
          return false;
        }
      }

      console.log('✅ Session is valid');
      return true;
    } catch (error) {
      console.error('💥 Error checking session:', error);
      return false;
    }
  }, []);

  // Add a function to handle database connection issues
  const handleDatabaseError = useCallback((error: any) => {
    console.error('❌ Database error:', error);
    
    // Check if it's an authentication error
    if (error?.message?.includes('JWT') || error?.message?.includes('auth')) {
      Alert.alert(
        'Authentication Error',
        'Please log in again to continue using notes.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/');
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'Connection Error',
        'Unable to connect to the database. Please check your internet connection and try again.',
        [
          {
            text: 'Retry',
            onPress: () => {
              // We'll handle this in the fetchNotes function
              console.log('Retry requested');
            }
          },
          {
            text: 'OK',
            style: 'cancel'
          }
        ]
      );
    }
  }, [router]);

  // Optimized fetch function with caching
  const fetchNotes = useCallback(async (forceRefresh = false) => {
    try {
      console.log('🔍 Starting fetchNotes...');
      
      // Prevent rapid successive calls
      const now = Date.now();
      if (!forceRefresh && now - lastFetchRef.current < 2000) {
        console.log('⏭️ Skipping fetch - too soon since last fetch');
        return;
      }
      lastFetchRef.current = now;
      
      // Check if we have a cached user and if we should skip fetch
      if (!forceRefresh && !isInitialLoad && user && Date.now() - lastFetchTime < 30000) {
        console.log('⏭️ Skipping fetch - using cached data');
        return;
      }

      // Check and refresh session if needed
      const sessionValid = await checkAndRefreshSession();
      if (!sessionValid) {
        console.log('❌ Session invalid, redirecting to home');
        router.replace('/');
        return;
      }

      console.log('🔐 Getting current user...');
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('❌ Auth error:', authError);
        handleDatabaseError(authError);
        return;
      }
      
      if (!currentUser) {
        console.log('❌ No user found, redirecting to home');
        router.replace('/');
        return;
      }

      console.log('✅ User authenticated:', currentUser.id);

      // Cache the user to avoid repeated auth calls
      setCachedUser(currentUser);

      console.log('📊 Fetching notes for user:', currentUser.id);
      
      // Check if notes table exists and is accessible
      const { data: tableCheck, error: tableError } = await supabase
        .from('notes')
        .select('id')
        .limit(1);

      if (tableError) {
        console.error('❌ Notes table access error:', tableError);
        handleDatabaseError(tableError);
        return;
      }

      console.log('✅ Notes table is accessible');
      
      // Use a more efficient query with specific columns
      const { data, error } = await supabase
        .from('notes')
        .select('id, title, content, user_id, created_at, updated_at')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false })
        .limit(50); // Limit initial load for better performance

      if (error) {
        console.error('❌ Supabase error:', error);
        handleDatabaseError(error);
        return;
      }
      
      console.log('✅ Fetched notes:', data?.length || 0);
      console.log('📝 Notes data:', data);
      
      setNotes(data || []);
      setLastFetchTime(Date.now());
      setIsInitialLoad(false);
    } catch (error) {
      console.error('💥 Error fetching notes:', error);
      handleDatabaseError(error);
    } finally {
      setIsLoading(false);
    }
  }, [user, lastFetchTime, isInitialLoad, router, checkAndRefreshSession, handleDatabaseError]);

  // Optimized useEffect with better dependency management
  useEffect(() => {
    console.log('🔄 Setting up notes component...');
    fetchNotes(true);
    
    // Set up real-time subscription for notes changes
    if (user?.id) {
      console.log('🔌 Setting up real-time subscription for notes...');
      const notesSubscription = supabase
        .channel('notes-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notes',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('🔄 Notes real-time update:', payload);
            // Only fetch if we have a user and it's not the initial load
            // Add debouncing to prevent constant refreshing
            if (user && !isInitialLoad && !isLoading) {
              // Debounce the fetch to prevent rapid successive calls
              const timeoutId = setTimeout(() => {
                fetchNotes(true);
              }, 1000); // Wait 1 second before fetching
              
              // Clean up timeout if component unmounts
              return () => clearTimeout(timeoutId);
            }
          }
        )
        .subscribe((status) => {
          console.log('🔌 Real-time subscription status:', status);
        });

      return () => {
        console.log('🔌 Cleaning up real-time subscription...');
        notesSubscription.unsubscribe();
      };
    }
  }, [user?.id]); // Remove fetchNotes and isInitialLoad from dependencies to prevent re-subscription

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotes(true);
    setRefreshing(false);
  }, [fetchNotes]);

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
          // Optimistic update for existing note
          const optimisticNote = {
            ...note,
            title,
            content: body,
            updated_at: new Date().toISOString(),
          };

          setNotes(prevNotes =>
            prevNotes.map(n =>
              n.id === note.id ? optimisticNote : n
            ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          );

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
            setNotes(prevNotes =>
              prevNotes.map(n =>
                n.id === note.id ? note : n
              ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            );
            throw error;
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

          setNotes(prevNotes => [optimisticNote, ...prevNotes]);

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
            setNotes(prevNotes => prevNotes.filter(n => n.id !== newNoteId));
            throw error;
          }

          // Replace optimistic note with real one
          setNotes(prevNotes =>
            prevNotes.map(n =>
              n.id === newNoteId ? data : n
            )
          );
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
    }, 300), // Reduced debounce time for faster saves
    [user, splitContent]
  );

  const handleContentChange = useCallback((text: string) => {
    setNoteContent(text);
    debouncedSave(text, currentNote);
  }, [debouncedSave, currentNote]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    try {
      if (!user) {
        console.error('No cached user found');
        return;
      }

      // Optimistic delete - remove from UI immediately
      const noteToDelete = notes.find(note => note.id === noteId);
      setNotes(prevNotes => prevNotes.filter(note => note.id !== noteId));
      
      if (currentNote?.id === noteId) {
        setShowNoteModal(false);
        setCurrentNote(null);
        setNoteContent('');
      }

      // Delete from database
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', user.id);

      if (error) {
        // Revert optimistic delete on error
        if (noteToDelete) {
          setNotes(prevNotes => [...prevNotes, noteToDelete].sort((a, b) => 
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          ));
        }
        throw error;
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      Alert.alert('Error', 'Failed to delete note');
    }
  }, [user, notes, currentNote]);

  const handleOpenNote = useCallback((note: Note) => {
    setCurrentNote(note);
    setNoteContent(note.title !== 'Untitled Note' ? note.title + '\n' + note.content : note.content);
    setShowNoteModal(true);
    setIsEditing(false);
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
    setIsEditing(true);
  }, []);

  // Memoized note item renderer for better performance
  const renderNoteItem = useCallback(({ item: note }: { item: Note }) => {
    const renderRightActions = () => {
      return (
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
          <Ionicons name="trash" size={24} color="#fff" />
        </TouchableOpacity>
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
          delayLongPress={500}
        >
          <View style={styles.noteContent}>
            <Text style={styles.notePreviewTitle} numberOfLines={1}>
              {note.title}
            </Text>
            {note.content ? (
              <Text style={styles.notePreviewContent} numberOfLines={2}>
                {note.content}
              </Text>
            ) : null}
            <Text style={styles.noteDate}>
              {moment(note.updated_at).fromNow()}
            </Text>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  }, [handleDeleteNote, handleOpenNote]);

  // Memoized key extractor for FlatList
  const keyExtractor = useCallback((item: Note) => item.id, []);

  // Memoized empty state component
  const EmptyState = useMemo(() => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No notes</Text>
      <Text style={styles.emptyStateSubtitle}>
        Create your first note
      </Text>
    </View>
  ), []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {/* Minimal Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Notes</Text>
          <TouchableOpacity
            onPress={handleNewNote}
            style={styles.addButton}
          >
            <Ionicons name="add" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Notes List - Using FlatList for better performance */}
        <GestureHandlerRootView style={{ flex: 1 }}>
          {isLoading && isInitialLoad ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#666" />
            </View>
          ) : (
            <FlatList
              data={notes}
              renderItem={renderNoteItem}
              keyExtractor={keyExtractor}
              style={styles.notesList}
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
              ListEmptyComponent={EmptyState}
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
          )}
        </GestureHandlerRootView>

        {/* Note Modal */}
        <Modal
          visible={showNoteModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleCloseNote}
          onDismiss={handleModalClose}
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
                
                <TouchableOpacity
                  onPress={handleCloseNote}
                  style={styles.modalCloseButton}
                >
                  <Text style={styles.modalCloseText}>Done</Text>
                </TouchableOpacity>
              </View>

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
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Onest',
  },
  addButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
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
  notePreviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
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
    paddingHorizontal: 12,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    fontFamily: 'Onest',
  },
  modalCloseButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
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
  noteEditor: {
    flex: 1,
    fontSize: 18,
    color: '#000',
    lineHeight: 26,
    padding: 20,
    textAlignVertical: 'top',
    fontFamily: 'Onest',
  },
  deleteAction: {
    backgroundColor: '#ff3b30',
    width: 80,
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
}); 