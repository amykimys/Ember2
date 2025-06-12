import React, { useEffect, useState, useCallback } from 'react';
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

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found, redirecting to home');
        router.replace('/');
        return;
      }

      // Cache the user to avoid repeated auth calls
      setCachedUser(user);

      console.log('Fetching notes for user:', user.id);
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Fetched notes:', data);
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      Alert.alert('Error', 'Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotes();
    setRefreshing(false);
  }, []);

  // Helper function to split content into title and body
  const splitContent = (content: string) => {
    const lines = content.split('\n');
    const title = lines[0] || 'Untitled Note';
    const body = lines.slice(1).join('\n');
    return { title, body };
  };

  // Optimized debounced save function with faster response
  const debouncedSave = useCallback(
    debounce(async (content: string, note: Note | null) => {
      if (!content.trim()) return;

      const user = cachedUser;
      if (!user) {
        console.error('No cached user found');
        return;
      }

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
            )
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
            )
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
    }, 500), // Reduced from 1000ms to 500ms for faster saves
    [cachedUser]
  );

  const handleContentChange = (text: string) => {
    setNoteContent(text);
    debouncedSave(text, currentNote);
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const user = cachedUser;
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
  };

  const handleOpenNote = (note: Note) => {
    setCurrentNote(note);
    setNoteContent(note.title !== 'Untitled Note' ? note.title + '\n' + note.content : note.content);
    setShowNoteModal(true);
  };

  const handleNewNote = () => {
    setCurrentNote(null);
    setNoteContent('');
    setShowNoteModal(true);
  };

  const handleCloseNote = () => {
    setShowNoteModal(false);
    // Don't clear the content immediately to avoid visual flicker
    // The content will be cleared when the modal fully closes
  };

  const handleModalClose = () => {
    // This function will be called when the modal is fully closed
    setCurrentNote(null);
    setNoteContent('');
  };

  const renderNoteItem = (note: Note) => {
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
  };

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

        {/* Notes List */}
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ScrollView 
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
          >
          {isLoading ? (
            <ActivityIndicator style={styles.loader} color="#666" />
          ) : notes.length === 0 ? (
            <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>No notes</Text>
              <Text style={styles.emptyStateSubtitle}>
                  Create your first note
              </Text>
            </View>
          ) : (
            notes.map(renderNoteItem)
          )}
        </ScrollView>
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
              <TextInput
                style={styles.noteEditor}
                placeholder="Start writing..."
                value={noteContent}
                onChangeText={handleContentChange}
                multiline
                textAlignVertical="top"
                autoFocus
              />
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
}); 