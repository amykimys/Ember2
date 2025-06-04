import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, StyleSheet, Platform, Alert, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '../supabase';

interface Note {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function NotesScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [noteText, setNoteText] = useState('');
  const [originalNoteText, setOriginalNoteText] = useState('');

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

      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (notesError) {
        console.error('Error fetching notes:', notesError);
        return;
      }

      setNotes(notesData || []);
    } catch (error) {
      console.error('Error in fetchNotes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to split note text into title and content
  const splitNoteText = (text: string) => {
    const lines = text.split('\n');
    const title = lines[0] || '';
    const content = lines.slice(1).join('\n');
    return { title, content };
  };

  // Helper function to combine title and content
  const combineNoteText = (title: string, content: string) => {
    return title + (content ? '\n' + content : '');
  };

  const handleBackPress = async () => {
    if (noteText !== originalNoteText) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.replace('/');
          return;
        }

        const { title, content } = splitNoteText(noteText.trim());

        if (currentNote) {
          const { error: updateError } = await supabase
            .from('notes')
            .update({
              title,
              content,
              updated_at: new Date().toISOString()
            })
            .eq('id', currentNote.id)
            .eq('user_id', user.id);

          if (updateError) throw updateError;

          setNotes(prevNotes => 
            prevNotes.map(note => 
              note.id === currentNote.id 
                ? { ...note, title, content, updated_at: new Date().toISOString() }
                : note
            )
          );
        } else {
          const { data: newNote, error } = await supabase
            .from('notes')
            .insert({
              title,
              content,
              user_id: user.id
            })
            .select()
            .single();

          if (error) throw error;
          if (newNote) {
            setNotes(prevNotes => [newNote, ...prevNotes]);
          }
        }
      } catch (error) {
        console.error('Error saving note:', error);
        Alert.alert('Error', 'Failed to save note. Please try again.');
        return;
      }
    }

    setIsAddingNote(false);
    setNoteText('');
    setOriginalNoteText('');
    setCurrentNote(null);
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

      setNotes(prev => prev.filter(note => note.id !== noteId));

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      Alert.alert('Error', 'Failed to delete note. Please try again.');
    }
  };

  const handleEditNote = (note: Note) => {
    const combinedText = combineNoteText(note.title, note.content);
    setCurrentNote(note);
    setNoteText(combinedText);
    setOriginalNoteText(combinedText);
    setIsAddingNote(true);
  };

  const handleViewNote = (note: Note) => {
    const combinedText = combineNoteText(note.title, note.content);
    setCurrentNote(note);
    setNoteText(combinedText);
    setOriginalNoteText(combinedText);
    setIsAddingNote(true);
  };

  const handleNoteTextChange = (text: string) => {
    setNoteText(text);
  };

  const handleLongPressNote = (note: Note) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    handleEditNote(note);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Notes',
          headerShown: false,
        }}
      />
      {!isAddingNote ? (
        <>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Notes</Text>
            <TouchableOpacity
              onPress={() => {
                setCurrentNote(null);
                setNoteText('');
                setOriginalNoteText('');
                setIsAddingNote(true);
              }}
              style={styles.addButton}
            >
              <Ionicons name="add" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#666" style={styles.loader} />
            ) : (
              <View style={styles.content}>
                {notes.length > 0 ? (
                  notes.map((note, index) => (
                    <View key={note.id}>
                      <Pressable
                        style={styles.noteItem}
                        onPress={() => handleViewNote(note)}
                        onLongPress={() => {
                          if (Platform.OS !== 'web') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          }
                          handleEditNote(note);
                        }}
                        delayLongPress={500}
                      >
                        <View style={styles.noteContent}>
                          <Text style={styles.noteTitle} numberOfLines={1}>
                            {note.title}
                          </Text>
                          {note.content ? (
                            <Text style={styles.noteText} numberOfLines={2}>
                              {note.content}
                            </Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            Alert.alert(
                              'Delete Note',
                              'Are you sure you want to delete this note?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { 
                                  text: 'Delete', 
                                  style: 'destructive',
                                  onPress: () => handleDeleteNote(note.id)
                                }
                              ]
                            );
                          }}
                          style={styles.noteDeleteButton}
                        >
                          <Ionicons name="trash-outline" size={16} color="#666" />
                        </TouchableOpacity>
                      </Pressable>
                      {index < notes.length - 1 && <View style={styles.itemDivider} />}
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No notes yet</Text>
                )}
              </View>
            )}
          </ScrollView>
        </>
      ) : (
        <View style={styles.fullScreenNote}>
          <View style={styles.noteHeader}>
            <TouchableOpacity
              onPress={handleBackPress}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={24} color="#666" />
            </TouchableOpacity>
            {noteText !== originalNoteText && (
              <Text style={styles.unsavedChanges}></Text>
            )}
          </View>
          <TextInput
            style={styles.fullScreenInput}
            placeholder={currentNote ? "Edit your note..." : "Write your note..."}
            value={noteText}
            onChangeText={handleNoteTextChange}
            multiline
            textAlignVertical="top"
            autoFocus
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: '#1A1A1A',
    fontFamily: 'Onest',
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loader: {
    marginTop: 20,
  },
  content: {
    padding: 12,
    gap: 8,
    marginTop: -10,
  },
  noteForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginHorizontal: -16,
  },
  noteInput: {
    borderWidth: 0,
    padding: 10,
    fontSize: 16,
    fontFamily: 'Onest',
    backgroundColor: '#FFFFFF',
    height: 350,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  noteFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Onest',
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FF9A8B',
  },
  saveButtonDisabled: {
    backgroundColor: '#F0F0F0',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Onest',
  },
  saveButtonTextDisabled: {
    color: '#999',
  },
  noteItem: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 0,
    borderColor: '#F0F0F0',
  },
  noteContent: {
    flex: 1,
    marginRight: 32,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 4,
    fontFamily: 'Onest',
  },
  noteText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Onest',
    lineHeight: 20,
  },
  noteDeleteButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  itemDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 13,
    fontFamily: 'Onest',
    marginVertical: 12,
  },
  addButton: {
    padding: 4,
  },
  fullScreenNote: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  fullScreenInput: {
    flex: 1,
    paddingTop: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Onest',
    backgroundColor: '#FFFFFF',
    textAlignVertical: 'top',
    lineHeight: 24,
    marginTop: -5,
  },
  unsavedChanges: {
    position: 'absolute',
    right: 16,
    color: '#666',
    fontSize: 14,
    fontFamily: 'Onest',
  },
}); 