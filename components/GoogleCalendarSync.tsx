import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { googleCalendarService, GoogleCalendar } from '../utils/googleCalendar';

interface GoogleCalendarSyncProps {
  onEventsSynced?: (events: any[]) => void;
  onCalendarUnsynced?: () => void;
  userId?: string;
}

export const GoogleCalendarSync: React.FC<GoogleCalendarSyncProps> = ({
  onEventsSynced,
  onCalendarUnsynced,
  userId,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [syncedCalendars, setSyncedCalendars] = useState<any[]>([]);

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
                    userId
                  );
                  allEvents.push(...events);
                } catch (error) {
                  console.error(`Error syncing calendar ${calendarId}:`, error);
                }
              }

              if (onEventsSynced) {
                onEventsSynced(allEvents);
              }

              Alert.alert(
                'Sync Complete',
                `Successfully synced ${allEvents.length} events from ${selectedCalendars.length} calendar(s) for the period (${currentYear - 1}-2028)`
              );
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="calendar" size={24} color="#667eea" />
        <Text style={styles.title}>Google Calendar Sync</Text>
      </View>

      {!isConnected ? (
        <View style={styles.connectSection}>
          <Text style={styles.description}>
            Connect your Google Calendar to sync events with this app
          </Text>
          <TouchableOpacity
            style={styles.connectButton}
            onPress={handleConnect}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="white" />
                <Text style={styles.connectButtonText}>Connect Google Calendar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.syncSection}>
          <View style={styles.connectionStatus}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <Text style={styles.connectedText}>Connected to Google Calendar</Text>
            <View style={styles.connectionButtons}>
              <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectButton}>
                <Text style={styles.disconnectButtonText}>Disconnect</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={async () => {
                  setIsLoading(true);
                  try {
                    const success = await googleCalendarService.reAuthenticate();
                    if (success) {
                      await loadCalendars();
                      Alert.alert('Success', 'Re-authenticated successfully!');
                    } else {
                      Alert.alert('Error', 'Failed to re-authenticate');
                    }
                  } catch (error) {
                    console.error('Re-authentication error:', error);
                    Alert.alert('Error', 'Failed to re-authenticate');
                  } finally {
                    setIsLoading(false);
                  }
                }} 
                style={styles.reauthButton}
              >
                <Text style={styles.reauthButtonText}>Re-authenticate</Text>
              </TouchableOpacity>
            </View>
          </View>

          {syncedCalendars.length > 0 && (
            <View style={styles.syncedSection}>
              <Text style={styles.sectionTitle}>Currently Synced Calendars</Text>
              <View style={styles.syncedCalendarsList}>
                {syncedCalendars.map(syncedCalendar => (
                  <View key={syncedCalendar.id} style={styles.syncedCalendarItem}>
                    <View style={styles.syncedCalendarInfo}>
                      <Text style={styles.syncedCalendarName}>{syncedCalendar.calendar_name}</Text>
                      {syncedCalendar.calendar_description && (
                        <Text style={styles.syncedCalendarDescription}>{syncedCalendar.calendar_description}</Text>
                      )}
                      <Text style={styles.lastSyncText}>
                        Last synced: {new Date(syncedCalendar.last_sync_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.unsyncButton}
                      onPress={() => handleUnsyncCalendar(syncedCalendar.google_calendar_id, syncedCalendar.calendar_name)}
                      disabled={isLoading}
                    >
                      <Ionicons name="close-circle" size={20} color="#FF6B6B" />
                      <Text style={styles.unsyncButtonText}>Unsync</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>
            Select Calendars to Sync 
            {calendars.length > 0 && (
              <Text style={styles.calendarCount}>
                {' '}({calendars.filter(cal => !syncedCalendars.some(synced => synced.google_calendar_id === cal.id)).length} available)
              </Text>
            )}
          </Text>
          
          <ScrollView 
            style={styles.calendarList}
            showsVerticalScrollIndicator={true}
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
                        {calendar.description && (
                          <Text style={styles.calendarDescription}>{calendar.description}</Text>
                        )}
                        <View style={styles.calendarBadges}>
                          {calendar.primary && (
                            <Text style={styles.primaryBadge}>Primary</Text>
                          )}
                        </View>
                      </View>
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={isSelected ? '#667eea' : '#ccc'}
                      />
                    </TouchableOpacity>
                  );
                })
            ) : (
              <View style={styles.noCalendarsContainer}>
                <Text style={styles.noCalendarsText}>
                  {calendars.length > 0 ? 'All calendars are already synced' : 'No calendars found'}
                </Text>
                <Text style={styles.noCalendarsSubtext}>
                  {calendars.length > 0 
                    ? 'To sync more calendars, first unsync some existing ones' 
                    : 'Make sure you have calendars in your Google account'
                  }
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
              <>
                <Ionicons name="sync" size={20} color="white" />
                <Text style={styles.syncButtonText}>
                  {selectedCalendars.length > 0 
                    ? `Sync ${selectedCalendars.length} Calendar${selectedCalendars.length !== 1 ? 's' : ''}` 
                    : calendars.filter(cal => !syncedCalendars.some(synced => synced.google_calendar_id === cal.id)).length === 0
                      ? 'All Calendars Synced'
                      : 'Select Calendars to Sync'
                  }
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
    color: '#333',
    fontFamily: 'Onest',
  },
  connectSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
    fontFamily: 'Onest',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  connectButtonText: {
    color: 'white',
    fontWeight: '600',
    fontFamily: 'Onest',
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
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
    fontFamily: 'Onest',
  },
  calendarList: {
    flex: 1,
    marginBottom: 16,
  },
  calendarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedCalendar: {
    borderColor: '#667eea',
    backgroundColor: '#f8f9ff',
  },
  syncedCalendar: {
    borderColor: '#4CAF50',
    backgroundColor: '#f0fff4',
  },
  calendarInfo: {
    flex: 1,
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
    color: '#667eea',
    backgroundColor: '#f0f2ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    fontFamily: 'Onest',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  syncButtonDisabled: {
    backgroundColor: '#ccc',
  },
  syncButtonText: {
    color: 'white',
    fontWeight: '600',
    fontFamily: 'Onest',
  },
  noCalendarsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noCalendarsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
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
    padding: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f0fff4',
  },
  syncedCalendarInfo: {
    flex: 1,
  },
  syncedCalendarName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    fontFamily: 'Onest',
  },
  syncedCalendarDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontFamily: 'Onest',
  },
  lastSyncText: {
    fontSize: 10,
    color: '#4CAF50',
    marginTop: 4,
    fontFamily: 'Onest',
  },
  unsyncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    gap: 4,
  },
  unsyncButtonText: {
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '500',
    fontFamily: 'Onest',
  },
  calendarCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '400',
    fontFamily: 'Onest',
  },
}); 