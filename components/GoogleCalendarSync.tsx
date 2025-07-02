import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { googleCalendarService, GoogleCalendar } from '../utils/googleCalendar';

interface GoogleCalendarSyncProps {
  onEventsSynced?: (events: any[]) => void;
  onCalendarUnsynced?: () => void;
  onCalendarColorUpdated?: () => void;
  userId?: string;
}

export const GoogleCalendarSync: React.FC<GoogleCalendarSyncProps> = ({
  onEventsSynced,
  onCalendarUnsynced,
  onCalendarColorUpdated,
  userId,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [syncedCalendars, setSyncedCalendars] = useState<any[]>([]);
  const [calendarColors, setCalendarColors] = useState<{ [calendarId: string]: string }>({});
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedCalendarForColor, setSelectedCalendarForColor] = useState<GoogleCalendar | null>(null);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const signedIn = await googleCalendarService.isSignedIn();
      setIsConnected(signedIn);
      if (signedIn) {
        loadCalendars();
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
    }
  };

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const success = await googleCalendarService.signIn();
      if (success) {
        setIsConnected(true);
        await loadCalendars();
        Alert.alert('Success', 'Successfully connected to Google Calendar!');
      } else {
        Alert.alert('Error', 'Failed to connect to Google Calendar');
      }
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Error', 'Failed to connect to Google Calendar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await googleCalendarService.signOut();
      setIsConnected(false);
      setCalendars([]);
      setSelectedCalendars([]);
      Alert.alert('Success', 'Disconnected from Google Calendar');
    } catch (error) {
      console.error('Disconnect error:', error);
      Alert.alert('Error', 'Failed to disconnect from Google Calendar');
    }
  };

    const loadCalendars = async () => {
    try {
      const userCalendars = await googleCalendarService.getCalendars();
      setCalendars(userCalendars);
      
      // Load synced calendars if user ID is available
      if (userId) {
        const synced = await googleCalendarService.getSyncedCalendars(userId);
        setSyncedCalendars(synced);
      }
    } catch (error) {
      console.error('Error loading calendars:', error);
    
      // Check if it's a scope-related error
      if (error instanceof Error && error.message.includes('403')) {
        Alert.alert(
          'Permission Required',
          'Calendar access permission is required. Please sign in again to grant the necessary permissions.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Re-authenticate',
              onPress: async () => {
                setIsLoading(true);
                try {
                  const success = await googleCalendarService.reAuthenticate();
                  if (success) {
                    await loadCalendars();
                  } else {
                    Alert.alert('Error', 'Failed to re-authenticate');
                  }
                } catch (reauthError) {
                  console.error('Re-authentication error:', reauthError);
                  Alert.alert('Error', 'Failed to re-authenticate');
                } finally {
                  setIsLoading(false);
                }
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to load calendars');
      }
    }
  };

  const toggleCalendarSelection = (calendarId: string) => {
    setSelectedCalendars(prev => {
      if (prev.includes(calendarId)) {
        return prev.filter(id => id !== calendarId);
      } else {
        return [...prev, calendarId];
      }
    });
  };

  const handleUnsyncCalendar = (calendarId: string, calendarName: string) => {
    Alert.alert(
      'Unsync Calendar',
      `Do you want to unsync "${calendarName}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Keep Events',
          onPress: async () => {
            await unsyncCalendar(calendarId, false);
          },
        },
        {
          text: 'Remove Events',
          style: 'destructive',
          onPress: async () => {
            await unsyncCalendar(calendarId, true);
          },
        },
      ]
    );
  };

  const unsyncCalendar = async (calendarId: string, removeEvents: boolean) => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setIsLoading(true);
    try {
      await googleCalendarService.unsyncCalendar(userId, calendarId, removeEvents);
      
      // Refresh the synced calendars list
      const synced = await googleCalendarService.getSyncedCalendars(userId);
      setSyncedCalendars(synced);
      
      // Remove from selected calendars if it was selected
      setSelectedCalendars(prev => prev.filter(id => id !== calendarId));
      
      Alert.alert(
        'Success',
        `Calendar unsynced successfully${removeEvents ? ' and events removed' : ''}`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Call the callback to refresh events if provided
              if (onCalendarUnsynced) {
                onCalendarUnsynced();
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error unsyncing calendar:', error);
      Alert.alert('Error', 'Failed to unsync calendar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    if (selectedCalendars.length === 0) {
      Alert.alert('Warning', 'Please select at least one calendar to sync');
      return;
    }

    const currentYear = new Date().getFullYear();

    // Show confirmation dialog before syncing
    Alert.alert(
      'Sync Calendar',
      `Do you want to sync ${selectedCalendars.length} calendar${selectedCalendars.length !== 1 ? 's' : ''}? This will import events from ${currentYear - 1} to 2028.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sync',
          onPress: async () => {
            setIsLoading(true);
            try {
              const allEvents: any[] = [];
              
              // Get date range for 5 years from January of previous year to December 2028
              const currentYear = new Date().getFullYear();
              const startDate = new Date(currentYear - 1, 0, 1); // January 1st of previous year
              const endDate = new Date(2028, 11, 31); // December 31st, 2028
              
              const timeMin = startDate.toISOString();
              const timeMax = endDate.toISOString();

              for (const calendarId of selectedCalendars) {
                try {
                  const events = await googleCalendarService.syncEventsToApp(
                    calendarId,
                    timeMin,
                    timeMax,
                    userId,
                    calendarColors[calendarId] // Pass the selected color
                  );
                  allEvents.push(...events);
                } catch (error) {
                  console.error(`Error syncing calendar ${calendarId}:`, error);
                }
              }

              if (onEventsSynced) {
                onEventsSynced(allEvents);
              }
            } catch (error) {
              console.error('Sync error:', error);
              Alert.alert('Error', 'Failed to sync events');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const openColorPicker = (calendar: GoogleCalendar) => {
    setSelectedCalendarForColor(calendar);
    setShowColorPicker(true);
  };

  const openColorPickerForSynced = (syncedCalendar: any) => {
    // Create a mock GoogleCalendar object for the synced calendar
    const mockCalendar: GoogleCalendar = {
      id: syncedCalendar.google_calendar_id,
      summary: syncedCalendar.calendar_name,
      description: syncedCalendar.calendar_description,
      primary: syncedCalendar.is_primary,
      backgroundColor: syncedCalendar.background_color,
      foregroundColor: syncedCalendar.foreground_color,
      accessRole: 'reader', // Default access role for synced calendars
    };
    setSelectedCalendarForColor(mockCalendar);
    setShowColorPicker(true);
  };

  const selectColor = async (color: string) => {
    if (selectedCalendarForColor) {
      // Check if this is a synced calendar
      const syncedCalendar = syncedCalendars.find(synced => synced.google_calendar_id === selectedCalendarForColor.id);
      
      if (syncedCalendar) {
        // Update the synced calendar's color in the database
        try {
          await googleCalendarService.updateSyncedCalendarColor(
            syncedCalendar.id,
            color
          );
          
          // Update local state
          setSyncedCalendars(prev => prev.map(cal => 
            cal.id === syncedCalendar.id 
              ? { ...cal, background_color: color }
              : cal
          ));
          
          // Trigger a refresh of the calendar display
          if (onCalendarColorUpdated) {
            onCalendarColorUpdated();
          }
          
          Alert.alert('Success', 'Calendar color updated successfully!');
        } catch (error) {
          console.error('Error updating calendar color:', error);
          Alert.alert('Error', 'Failed to update calendar color');
        }
      } else {
        // This is a new calendar, just update local state
        setCalendarColors(prev => ({
          ...prev,
          [selectedCalendarForColor.id]: color
        }));
      }
    }
    setShowColorPicker(false);
    setSelectedCalendarForColor(null);
  };

  const getCalendarColor = (calendarId: string) => {
    // First check if this is a synced calendar
    const syncedCalendar = syncedCalendars.find(synced => synced.google_calendar_id === calendarId);
    if (syncedCalendar) {
      return syncedCalendar.background_color || '#4285F4';
    }
    // Otherwise check the calendarColors state (for new calendars)
    return calendarColors[calendarId] || '#4285F4'; // Default to Google blue
  };

  return (
    <View style={styles.container}>
      {!isConnected ? (
        <View style={styles.connectSection}>
          <Ionicons name="logo-google" size={48} color="#4285F4" />
          <Text style={styles.title}>Connect Google Calendar</Text>
          <Text style={styles.description}>
            Sync your Google Calendar events with this app
          </Text>
          <TouchableOpacity
            style={styles.connectButton}
            onPress={handleConnect}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.connectButtonText}>Connect</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.syncSection}>
          {syncedCalendars.length > 0 && (
            <View style={styles.syncedSection}>
              <Text style={styles.sectionTitle}>Synced</Text>
              <View style={styles.syncedCalendarsList}>
                {syncedCalendars.map(syncedCalendar => (
                  <View key={syncedCalendar.id} style={styles.syncedCalendarItem}>
                    <View style={styles.syncedCalendarTopRow}>
                      <View style={styles.syncedCalendarInfo}>
                        <Text style={styles.syncedCalendarName}>{syncedCalendar.calendar_name}</Text>
                      </View>
                      <View style={styles.syncedCalendarActions}>
                        <TouchableOpacity
                          style={[
                            styles.colorPickerButton,
                            { backgroundColor: syncedCalendar.background_color || '#4285F4' }
                          ]}
                          onPress={() => openColorPickerForSynced(syncedCalendar)}
                        />
                        <TouchableOpacity
                          style={styles.unsyncButton}
                          onPress={() => handleUnsyncCalendar(syncedCalendar.google_calendar_id, syncedCalendar.calendar_name)}
                          disabled={isLoading}
                        >
                          <Ionicons name="close" size={16} color="#999" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>
            Available Calendars
            {calendars.length > 0 && (
              <Text style={styles.calendarCount}>
                {' '}({calendars.filter(cal => !syncedCalendars.some(synced => synced.google_calendar_id === cal.id)).length})
              </Text>
            )}
          </Text>
          
          <ScrollView 
            style={styles.calendarList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {calendars.length > 0 ? (
              calendars
                .filter(calendar => !syncedCalendars.some(synced => synced.google_calendar_id === calendar.id))
                .map(calendar => {
                  const isSelected = selectedCalendars.includes(calendar.id);
                  
                  return (
                    <TouchableOpacity
                      key={calendar.id}
                      style={[
                        styles.calendarItem,
                        isSelected && styles.selectedCalendar
                      ]}
                      onPress={() => toggleCalendarSelection(calendar.id)}
                    >
                      <View style={styles.calendarInfo}>
                        <Text style={styles.calendarName}>{calendar.summary}</Text>
                        {calendar.primary && (
                          <Text style={styles.primaryBadge}>Primary</Text>
                        )}
                      </View>
                      <View style={styles.calendarActions}>
                        {isSelected && (
                          <TouchableOpacity
                            style={[
                              styles.colorPickerButton,
                              { backgroundColor: getCalendarColor(calendar.id) }
                            ]}
                            onPress={() => openColorPicker(calendar)}
                          />
                        )}
                        <Ionicons
                          name={isSelected ? 'checkmark' : 'ellipse-outline'}
                          size={20}
                          color={isSelected ? '#4285F4' : '#ccc'}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })
            ) : (
              <View style={styles.noCalendarsContainer}>
                <Text style={styles.noCalendarsText}>
                  {calendars.length > 0 ? 'All calendars synced' : 'No calendars found'}
                </Text>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.syncButton,
              (selectedCalendars.length === 0 || calendars.filter(cal => !syncedCalendars.some(synced => synced.google_calendar_id === cal.id)).length === 0) && styles.syncButtonDisabled
            ]}
            onPress={handleSync}
            disabled={isLoading || selectedCalendars.length === 0 || calendars.filter(cal => !syncedCalendars.some(synced => synced.google_calendar_id === cal.id)).length === 0}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.syncButtonText}>
                {selectedCalendars.length > 0 
                  ? `Sync ${selectedCalendars.length} Calendar${selectedCalendars.length !== 1 ? 's' : ''}` 
                  : 'Sync Calendars'
                }
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Color Picker Modal */}
      <Modal
        visible={showColorPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowColorPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.colorPickerModal}>
            <Text style={styles.colorPickerTitle}>
              Choose Color for {selectedCalendarForColor?.summary}
            </Text>
            
            <View style={styles.colorGrid}>
              {[
                '#4285F4', '#EA4335', '#FBBC04', '#34A853', // Google colors
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', // Additional colors
                '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', // More colors
                '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', // Even more colors
                '#E74C3C', '#9B59B6', '#3498DB', '#1ABC9C', // Popular colors
                '#F1C40F', '#E67E22', '#95A5A6', '#34495E', // Final set
              ].map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    getCalendarColor(selectedCalendarForColor?.id || '') === color && styles.selectedColorOption
                  ]}
                  onPress={() => selectColor(color)}
                >
                  {getCalendarColor(selectedCalendarForColor?.id || '') === color && (
                    <Ionicons name="checkmark" size={20} color="white" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowColorPicker(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#1a73e8',
    fontFamily: 'Onest',
    textAlign: 'center',
  },
  connectSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#f8f9ff',
    borderRadius: 20,
    margin: 20,
  },
  description: {
    textAlign: 'center',
    color: '#5f6368',
    marginBottom: 32,
    lineHeight: 20,
    fontFamily: 'Onest',
    fontSize: 16,
  },
  connectButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 120,
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  connectButtonText: {
    color: 'white',
    fontWeight: '600',
    fontFamily: 'Onest',
    fontSize: 16,
    textAlign: 'center',
  },
  syncSection: {
    flex: 1,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  connectedText: {
    flex: 1,
    marginLeft: 8,
    color: '#4CAF50',
    fontWeight: '500',
    fontFamily: 'Onest',
  },
  connectionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  disconnectButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  disconnectButtonText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Onest',
  },
  reauthButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  reauthButtonText: {
    color: '#667eea',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Onest',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    marginTop: 24,
    color: '#1a73e8',
    fontFamily: 'Onest',
  },
  calendarList: {
    flex: 1,
    marginBottom: 20,
  },
  calendarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  selectedCalendar: {
    borderColor: '#4285F4',
    backgroundColor: '#f0f4ff',
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  colorPickerButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  syncedCalendar: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0fff4',
  },
  calendarInfo: {
    flex: 1,
  },
  calendarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  syncedBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4CAF50',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    fontFamily: 'Onest',
  },
  syncedBadgeContainer: {
    flexDirection: 'column',
    gap: 2,
  },
  unsyncHint: {
    fontSize: 8,
    color: '#666',
    fontFamily: 'Onest',
    fontStyle: 'italic',
  },
  calendarName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    fontFamily: 'Onest',
  },
  calendarDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontFamily: 'Onest',
  },
  primaryBadge: {
    fontSize: 10,
    color: '#ffffff',
    backgroundColor: '#4285F4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
    fontFamily: 'Onest',
    fontWeight: '600',
  },
  syncButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  syncButtonDisabled: {
    backgroundColor: '#b0b0b0',
    shadowOpacity: 0,
    elevation: 0,
  },
  syncButtonText: {
    color: 'white',
    fontWeight: '600',
    fontFamily: 'Onest',
    fontSize: 16,
  },
  noCalendarsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#f8f9ff',
    borderRadius: 16,
    margin: 20,
  },
  noCalendarsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#5f6368',
    marginBottom: 8,
    fontFamily: 'Onest',
  },
  noCalendarsSubtext: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'Onest',
  },
  syncedSection: {
    marginBottom: 20,
  },
  syncedCalendarsList: {
    marginBottom: 16,
  },
  syncedCalendarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#e8f0fe',
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f8f9ff',
  },
  syncedCalendarInfo: {
    flex: 1,
  },
  syncedCalendarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncedCalendarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncedCalendarName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    fontFamily: 'Onest',
  },
  unsyncButton: {
    padding: 8,
    borderRadius: 8,
  },
  calendarCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '400',
    fontFamily: 'Onest',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPickerModal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  colorPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
    fontFamily: 'Onest',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  selectedColorOption: {
    borderColor: '#333',
    borderWidth: 3,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '500',
    fontFamily: 'Onest',
  },
}); 