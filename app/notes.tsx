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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '../supabase';
import * as Haptics from 'expo-haptics';
import moment from 'moment';
import debounce from 'lodash/debounce';

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
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/');
        return;
      }

      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      Alert.alert('Error', 'Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to split content into title and body
  const splitContent = (content: string) => {
    const lines = content.split('\n');
    const title = lines[0] || 'Untitled Note';
    const body = lines.slice(1).join('\n');
    return { title, body };
  };

  // Debounced save function to prevent too many API calls
  const debouncedSave = useCallback(
    debounce(async (content: string, note: Note | null) => {
      if (!content.trim()) return;

      setIsSaving(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/');
          return;
        }

        const { title, body } = splitContent(content.trim());

        if (note) {
          // Update existing note
          const { error } = await supabase
            .from('notes')
            .update({
              title,
              content: body,
              updated_at: new Date().toISOString(),
            })
            .eq('id', note.id)
            .eq('user_id', user.id);

          if (error) throw error;

          setNotes(prevNotes =>
            prevNotes.map(n =>
              n.id === note.id
                ? {
                    ...n,
                    title,
                    content: body,
                    updated_at: new Date().toISOString(),
                  }
                : n
            )
          );
        } else {
          // Create new note
          const { data, error } = await supabase
            .from('notes')
            .insert({
              title,
              content: body,
              user_id: user.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (error) throw error;
          setNotes(prevNotes => [data, ...prevNotes]);
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
    }, 1000),
    []
  );

  const handleContentChange = (text: string) => {
    setNoteContent(text);
    debouncedSave(text, currentNote);
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/');
        return;
      }

      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotes(prevNotes => prevNotes.filter(note => note.id !== noteId));
      if (currentNote?.id === noteId) {
        setShowNoteModal(false);
        setCurrentNote(null);
        setNoteContent('');
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
    setCurrentNote(null);
    setNoteContent('');
  };

  const renderNoteItem = (note: Note) => {
    return (
      <TouchableOpacity
        key={note.id}
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
          <View style={styles.notePreview}>
            <Text style={styles.notePreviewTitle} numberOfLines={1}>
              {note.title}
            </Text>
            {note.content ? (
              <Text style={styles.notePreviewContent} numberOfLines={2}>
                {note.content}
              </Text>
            ) : null}
          </View>
          <Text style={styles.noteDate}>
            {moment(note.updated_at).fromNow()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notes</Text>
          <TouchableOpacity
            onPress={handleNewNote}
            style={styles.addButton}
          >
            <Ionicons name="add" size={24} color="#FF9A8B" />
          </TouchableOpacity>
        </View>

        {/* Notes List */}
        <ScrollView style={styles.notesList}>
          {isLoading ? (
            <ActivityIndicator style={styles.loader} color="#666" />
          ) : notes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No notes yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Tap the + button to create your first note
              </Text>
            </View>
          ) : (
            notes.map(renderNoteItem)
          )}
        </ScrollView>

        {/* Note Modal */}
        <Modal
          visible={showNoteModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <SafeAreaView style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  onPress={handleCloseNote}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="chevron-back" size={24} color="#000" />
                </TouchableOpacity>
                {isSaving && (
                  <ActivityIndicator size="small" color="#666" style={styles.savingIndicator} />
                )}
                <View style={styles.modalCloseButton} />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  notesList: {
    flex: 1,
  },
  loader: {
    marginTop: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  noteContent: {
    flex: 1,
  },
  notePreview: {
    marginBottom: 4,
  },
  notePreviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  notePreviewContent: {
    fontSize: 16,
    color: '#000',
    lineHeight: 22,
  },
  noteDate: {
    fontSize: 12,
    color: '#999',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingIndicator: {
    marginHorizontal: 8,
  },
  noteEditor: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
    padding: 16,
    textAlignVertical: 'top',
  },
}); 