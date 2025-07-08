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
import { useRouter, Stack } from 'expo-router';
import { supabase } from '../../supabase';
import * as Haptics from 'expo-haptics';
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
  type SharedNote,
  type NoteCollaborator
} from '../../utils/sharedNotes';

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

  // Comprehensive loading state management
  const [loadingStates, setLoadingStates] = useState({
    notes: true,
    sharedNotes: true,
    sharedNoteIds: true,
    user: true
  });

  // Shared notes state
  const [sharedNotes, setSharedNotes] = useState<SharedNote[]>([]);
  const [combinedNotes, setCombinedNotes] = useState<Note[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedNoteForSharing, setSelectedNoteForSharing] = useState<Note | null>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  // Add friends state
  const [showAddFriendsModal, setShowAddFriendsModal] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friendSearchTerm, setFriendSearchTerm] = useState('');
  const [isSearchingFriends, setIsSearchingFriends] = useState(false);
  const [currentNoteForSharing, setCurrentNoteForSharing] = useState<Note | null>(null);
  const [isTemporarilyClosingModal, setIsTemporarilyClosingModal] = useState(false);

  // Debug modal states
  useEffect(() => {
    console.log('Modal states changed:', {
      showNoteModal,
      showAddFriendsModal,
      showShareModal
    });
  }, [showNoteModal, showAddFriendsModal, showShareModal]);

  // Collaboration state
  const [noteCollaborators, setNoteCollaborators] = useState<NoteCollaborator[]>([]);
  const [showCollaborators, setShowCollaborators] = useState(false);
  
  // Shared notes tracking
  const [sharedNoteIds, setSharedNoteIds] = useState<Set<string>>(new Set());
  const [sharedNoteDetails, setSharedNoteDetails] = useState<Map<string, string[]>>(new Map());

  // Combine regular notes and shared notes
  const combineNotes = useCallback(() => {
    const combined: Note[] = [...notes];
    
    // Add shared notes to the combined list
    sharedNotes.forEach(sharedNote => {
      const sharedNoteItem: Note = {
        id: sharedNote.original_note_id,
        title: sharedNote.note_title,
        content: sharedNote.note_content,
        user_id: sharedNote.shared_by_name, // This will show who shared it
        created_at: sharedNote.shared_at,
        updated_at: sharedNote.shared_at,
        isShared: true,
        sharedBy: sharedNote.shared_by_name,
        canEdit: sharedNote.can_edit,
      };
      combined.push(sharedNoteItem);
    });
    
    // Sort by updated_at (most recent first)
    combined.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    
    setCombinedNotes(combined);
  }, [notes, sharedNotes]);

  // Memoize user to prevent unnecessary re-renders
  const user = useMemo(() => cachedUser, [cachedUser]);

  // Check if all initial data is loaded
  const isAllDataLoaded = useMemo(() => {
    return !loadingStates.notes && 
           !loadingStates.sharedNotes && 
           !loadingStates.sharedNoteIds && 
           !loadingStates.user;
  }, [loadingStates]);

  // Update main loading state based on all loading states
  useEffect(() => {
    if (isAllDataLoaded && isInitialLoad) {
      // Add a minimum loading time to ensure smooth UX
      const minLoadingTime = 800; // 800ms minimum
      const timeSinceStart = Date.now() - (window as any).__notesLoadStart || 0;
      
      if (timeSinceStart < minLoadingTime) {
        setTimeout(() => {
          setIsLoading(false);
          setIsInitialLoad(false);
        }, minLoadingTime - timeSinceStart);
      } else {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    }
  }, [isAllDataLoaded, isInitialLoad]);

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
      
      // Set loading state for notes
      if (isInitialLoad) {
        setLoadingStates(prev => ({ ...prev, notes: true }));
      }
      
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
        setLoadingStates(prev => ({ ...prev, user: false }));
        router.replace('/');
        return;
      }

      console.log('🔐 Getting current user...');
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('❌ Auth error:', authError);
        setLoadingStates(prev => ({ ...prev, user: false }));
        handleDatabaseError(authError);
        return;
      }
      
      if (!currentUser) {
        console.log('❌ No user found, redirecting to home');
        setLoadingStates(prev => ({ ...prev, user: false }));
        router.replace('/');
        return;
      }

      console.log('✅ User authenticated:', currentUser.id);

      // Cache the user to avoid repeated auth calls
      setCachedUser(currentUser);
      
      // Mark user as loaded
      setLoadingStates(prev => ({ ...prev, user: false }));

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
      
      // Mark notes as loaded
      setLoadingStates(prev => ({ ...prev, notes: false }));
    } catch (error) {
      console.error('💥 Error fetching notes:', error);
      handleDatabaseError(error);
      // Mark notes as loaded even on error to prevent infinite loading
      setLoadingStates(prev => ({ ...prev, notes: false }));
    }
  }, [user, lastFetchTime, isInitialLoad, router, checkAndRefreshSession, handleDatabaseError]);



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
        <View style={styles.rightActions}>
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
            <View style={styles.noteHeader}>
              <Text style={styles.notePreviewTitle} numberOfLines={1}>
                {note.title}
              </Text>
              {note.isShared ? (
                <View style={styles.sharedIndicator}>
                  <Ionicons name="people" size={14} color="#007AFF" />
                </View>
              ) : sharedNoteIds.has(note.id) && (
                <View style={styles.sharedIndicator}>
                  <Ionicons name="share" size={14} color="#34C759" />
                </View>
              )}
            </View>
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

  // Shared notes functions
  const loadSharedNotes = useCallback(async () => {
    try {
      console.log('🔄 Loading shared notes...');
      setLoadingStates(prev => ({ ...prev, sharedNotes: true }));
      
      const result = await getSharedNotes();
      if (result.success && result.data) {
        setSharedNotes(result.data);
        console.log('✅ Loaded shared notes:', result.data.length);
      }
    } catch (error) {
      console.error('Error loading shared notes:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, sharedNotes: false }));
    }
  }, []);

  // Load shared note IDs and friend names for current user's notes
  const loadSharedNoteIds = useCallback(async () => {
    try {
      console.log('🔄 Loading shared note IDs...');
      setLoadingStates(prev => ({ ...prev, sharedNoteIds: true }));
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoadingStates(prev => ({ ...prev, sharedNoteIds: false }));
        return;
      }

      // Use a direct query to get shared notes with friend names
      const { data, error } = await supabase
        .from('shared_notes')
        .select(`
          original_note_id,
          shared_with
        `)
        .eq('shared_by', user.id)
        .eq('status', 'accepted');

      if (error) {
        console.error('Error loading shared note IDs:', error);
        return;
      }

      const sharedIds = new Set<string>();
      const sharedDetails = new Map<string, string[]>();

      // Get unique friend IDs to fetch their names
      const friendIds = Array.from(new Set(data?.map(item => item.shared_with) || []));
      
      if (friendIds.length > 0) {
        // Fetch friend names in a separate query
        const { data: friendData, error: friendError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', friendIds);

        if (friendError) {
          console.error('Error loading friend names:', friendError);
        } else {
          // Create a map of friend ID to name
          const friendNameMap = new Map(
            friendData?.map(friend => [friend.id, friend.full_name]) || []
          );

          // Process shared notes data
          data?.forEach(item => {
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
      }

      setSharedNoteIds(sharedIds);
      setSharedNoteDetails(sharedDetails);
      console.log('✅ Loaded shared note IDs:', sharedIds.size);
    } catch (error) {
      console.error('Error in loadSharedNoteIds:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, sharedNoteIds: false }));
    }
  }, []);



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
    if (!selectedNoteForSharing || selectedFriends.size === 0) return;

    try {
      const result = await shareNoteWithFriends(
        selectedNoteForSharing.id,
        Array.from(selectedFriends),
        true // canEdit
      );

      if (result.success) {
        setShowShareModal(false);
        setSelectedNoteForSharing(null);
        setSelectedFriends(new Set());
      } else {
        Alert.alert('Error', result.error || 'Failed to share note');
      }
    } catch (error) {
      console.error('Error sharing note:', error);
      Alert.alert('Error', 'Failed to share note');
    }
  }, [selectedNoteForSharing, selectedFriends]);

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

  const checkNoteEditPermissions = useCallback(async (noteId: string) => {
    try {
      const result = await canUserEditNote(noteId);
      return result;
    } catch (error) {
      console.error('Error checking edit permissions:', error);
      return false;
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

  // Set up initial data loading and real-time subscriptions
  useEffect(() => {
    console.log('🔄 Setting up notes component...');
    
    // Set load start time for minimum loading duration
    (window as any).__notesLoadStart = Date.now();
    
    // Initialize loading states for initial load
    setLoadingStates({
      notes: true,
      sharedNotes: true,
      sharedNoteIds: true,
      user: true
    });
    
    // Load all data in parallel
    fetchNotes(true);
    loadSharedNotes();
    loadSharedNoteIds();
    
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

      // Set up real-time subscription for shared notes
      const sharedNotesSubscription = subscribeToSharedNotes((sharedNotes: SharedNote[]) => {
        setSharedNotes(sharedNotes);
        // Also refresh shared note IDs and details when shared notes change
        loadSharedNoteIds();
      });

      return () => {
        console.log('🔌 Cleaning up real-time subscriptions...');
        notesSubscription.unsubscribe();
        sharedNotesSubscription.unsubscribe(); // Use unsubscribe method
      };
    }
  }, [user?.id]); // Remove fetchNotes and isInitialLoad from dependencies to prevent re-subscription

  // Update combined notes whenever notes or shared notes change
  useEffect(() => {
    combineNotes();
  }, [combineNotes]);

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
          {isLoading && isInitialLoad ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#666" />
              <Text style={styles.loadingText}>Loading your notes...</Text>
              <View style={styles.loadingProgress}>
                <Text style={styles.loadingProgressText}>
                  {!loadingStates.user ? '✓' : '○'} User
                </Text>
                <Text style={styles.loadingProgressText}>
                  {!loadingStates.notes ? '✓' : '○'} Notes
                </Text>
                <Text style={styles.loadingProgressText}>
                  {!loadingStates.sharedNotes ? '✓' : '○'} Shared Notes
                </Text>
                <Text style={styles.loadingProgressText}>
                  {!loadingStates.sharedNoteIds ? '✓' : '○'} Sharing Info
                </Text>
              </View>
            </View>
          ) : (
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
                
                <View style={styles.modalRightButtons}>
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
                    <Ionicons name="person-add-outline" size={20} color="#007AFF" />
                  </TouchableOpacity>
                  {currentNote && (
                    <TouchableOpacity
                      onPress={() => handleShareNote(currentNote)}
                      style={styles.modalShareButton}
                    >
                      <Ionicons name="share-outline" size={20} color="#007AFF" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={handleCloseNote}
                    style={styles.modalCloseButton}
                  >
                    <Text style={styles.modalCloseText}>Save</Text>
                  </TouchableOpacity>
                </View>
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
                            : { backgroundColor: '#007AFF' }
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
  addButton: {
    position: 'absolute',
    right: 24,
    bottom: 100,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0f172a',
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
  sharedWithContainer: {
    marginBottom: 4,
  },
  sharedWithText: {
    fontSize: 12,
    color: '#007AFF',
    fontFamily: 'Onest',
    fontStyle: 'italic',
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
  modalShareButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
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
    backgroundColor: '#007AFF',
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
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
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
}); 