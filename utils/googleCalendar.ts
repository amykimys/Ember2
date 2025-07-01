import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { supabase } from '../supabase';

// Configure Google Sign-In with calendar scopes
GoogleSignin.configure({
  webClientId: '407418160129-8u96bsrh8j1madb0r7trr0k6ci327gds.apps.googleusercontent.com',
  iosClientId: '407418160129-8u96bsrh8j1madb0r7trr0k6ci327gds.apps.googleusercontent.com',
  offlineAccess: true,
  scopes: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ]
});

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  allDay?: boolean;
  colorId?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole: string;
}

class GoogleCalendarService {
  private accessToken: string | null = null;

  // Sign in with Google
  async signIn(): Promise<boolean> {
    try {
      await GoogleSignin.hasPlayServices();
      
      // Sign out first to ensure fresh authentication
      await GoogleSignin.signOut();
      
      const userInfo = await GoogleSignin.signIn();
      console.log('Google Sign-In successful');
      
      const tokens = await GoogleSignin.getTokens();
      this.accessToken = tokens.accessToken;
      console.log('Access token obtained, length:', this.accessToken?.length);
      
      return true;
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      return false;
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      await GoogleSignin.signOut();
      this.accessToken = null;
      console.log('Google Sign-Out successful');
    } catch (error) {
      console.error('Google Sign-Out Error:', error);
    }
  }

  // Check if user is signed in
  async isSignedIn(): Promise<boolean> {
    try {
      // Check if we have a valid access token
      if (this.accessToken) {
        console.log('User is signed in, token length:', this.accessToken.length);
        return true;
      }
      
      // If no access token, try to get it from Google Sign-In
      const isSignedIn = await GoogleSignin.getCurrentUser() !== null;
      if (isSignedIn) {
        const tokens = await GoogleSignin.getTokens();
        this.accessToken = tokens.accessToken;
        console.log('User is signed in via Google Sign-In, token length:', this.accessToken?.length);
        return true;
      } else {
        console.log('User is not signed in');
        return false;
      }
    } catch (error) {
      console.error('Check Sign-In Error:', error);
      return false;
    }
  }

  // Force re-authentication with proper scopes
  async reAuthenticate(): Promise<boolean> {
    try {
      console.log('Forcing re-authentication to get proper scopes...');
      await GoogleSignin.signOut();
      return await this.signIn();
    } catch (error) {
      console.error('Re-authentication Error:', error);
      return false;
    }
  }

  // Test basic authentication by getting user info
  async testAuthentication(): Promise<boolean> {
    try {
      if (!this.accessToken) {
        console.log('No access token available');
        return false;
      }

      console.log('Testing authentication with Google OAuth2 userinfo...');
      
      const response = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('OAuth2 userinfo response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OAuth2 userinfo error response:', errorText);
        return false;
      }

      const data = await response.json();
      console.log('Authentication test successful:', data);
      return true;
    } catch (error) {
      console.error('Authentication test error:', error);
      return false;
    }
  }

  // Get user's calendars with better error handling
  async getCalendars(): Promise<GoogleCalendar[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated - no access token available');
    }

    // First test basic authentication
    const authTest = await this.testAuthentication();
    if (!authTest) {
      throw new Error('Basic authentication failed - token may be invalid');
    }

    try {
      console.log('Fetching calendars with token length:', this.accessToken.length);
      
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Calendar API response status:', response.status);
      console.log('Calendar API response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Calendar API error response:', errorText);
        
        if (response.status === 403) {
          // Check if it's a scope issue
          if (errorText.includes('insufficientPermissions') || errorText.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
            throw new Error('403: Insufficient permissions - calendar scopes not granted. Please re-authenticate.');
          }
        }
        
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      console.log('Calendars fetched successfully, count:', data.items?.length || 0);
      return data.items || [];
    } catch (error) {
      console.error('Get Calendars Error:', error);
      throw error;
    }
  }

  // Get events from a specific calendar
  async getEvents(
    calendarId: string = 'primary',
    timeMin?: string,
    timeMax?: string,
    maxResults: number = 100
  ): Promise<GoogleCalendarEvent[]> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const params = new URLSearchParams({
        maxResults: maxResults.toString(),
        singleEvents: 'true',
        orderBy: 'startTime',
      });

      if (timeMin) {
        params.append('timeMin', timeMin);
      }
      if (timeMax) {
        params.append('timeMax', timeMax);
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Get Events Error:', error);
      throw error;
    }
  }

  // Create a new event
  async createEvent(
    calendarId: string = 'primary',
    event: Omit<GoogleCalendarEvent, 'id'>
  ): Promise<GoogleCalendarEvent> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Create Event Error:', error);
      throw error;
    }
  }

  // Update an existing event
  async updateEvent(
    calendarId: string = 'primary',
    eventId: string,
    event: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Update Event Error:', error);
      throw error;
    }
  }

  // Delete an event
  async deleteEvent(calendarId: string = 'primary', eventId: string): Promise<void> {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Delete Event Error:', error);
      throw error;
    }
  }

  // Sync events from Google Calendar to your app
  async syncEventsToApp(
    calendarId: string = 'primary',
    timeMin?: string,
    timeMax?: string,
    userId?: string
  ): Promise<any[]> {
    try {
      const events = await this.getEvents(calendarId, timeMin, timeMax);
      
      // Transform Google Calendar events to your app's format
      const transformedEvents = events.map(event => {
        // Parse start and end times
        const startDate = event.start.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date!);
        const endDate = event.end.dateTime ? new Date(event.end.dateTime) : new Date(event.end.date!);
        
        // Determine if it's an all-day event
        const isAllDay = !event.start.dateTime && !event.end.dateTime;
        
        // Create the transformed event
        const transformedEvent = {
          id: `google_${event.id}`, // Prefix to avoid conflicts
          title: event.summary || 'Untitled Event',
          description: event.description || '',
          location: event.location || '',
          date: startDate.toISOString().split('T')[0], // YYYY-MM-DD format
          startDateTime: isAllDay ? undefined : startDate,
          endDateTime: isAllDay ? undefined : endDate,
          isAllDay: isAllDay,
          categoryName: 'Google Calendar',
          categoryColor: '#4285F4', // Google blue
          reminderTime: null,
          repeatOption: 'None' as const,
          repeatEndDate: null,
          customDates: [],
          customTimes: {},
          isContinued: false,
          photos: [],
          // Add Google Calendar metadata
          googleCalendarId: calendarId,
          googleEventId: event.id,
          isGoogleEvent: true,
        };

        return transformedEvent;
      });

      // Save events to your app's database
      if (userId) {
        await this.saveEventsToDatabase(transformedEvents, userId);
        
        // Track the synced calendar
        const calendar = await this.getCalendarInfo(calendarId);
        if (calendar) {
          await this.trackSyncedCalendar(
            userId,
            calendarId,
            calendar.summary,
            calendar.description,
            calendar.primary
          );
        }
      }

      return transformedEvents;
    } catch (error) {
      console.error('Sync Events Error:', error);
      throw error;
    }
  }

  // Save events to your app's database
  private async saveEventsToDatabase(events: any[], userId: string): Promise<void> {
    try {
      // Insert events into your database
      for (const event of events) {
        const { error } = await supabase
          .from('events')
          .upsert({
            id: event.id,
            user_id: userId,
            title: event.title,
            description: event.description,
            location: event.location,
            date: event.date,
            start_datetime: event.startDateTime?.toISOString(),
            end_datetime: event.endDateTime?.toISOString(),
            is_all_day: event.isAllDay,
            category_name: event.categoryName,
            category_color: event.categoryColor,
            google_calendar_id: event.googleCalendarId,
            google_event_id: event.googleEventId,
            is_google_event: event.isGoogleEvent,
            created_at: new Date().toISOString(),
          });

        if (error) {
          console.error('Error saving event to database:', error);
        }
      }

      console.log(`Successfully saved ${events.length} events to database`);
    } catch (error) {
      console.error('Error saving events to database:', error);
      throw error;
    }
  }

  // Track synced calendar
  async trackSyncedCalendar(
    userId: string,
    calendarId: string,
    calendarName: string,
    calendarDescription?: string,
    isPrimary: boolean = false
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('synced_calendars')
        .upsert({
          user_id: userId,
          google_calendar_id: calendarId,
          calendar_name: calendarName,
          calendar_description: calendarDescription,
          is_primary: isPrimary,
          last_sync_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error tracking synced calendar:', error);
      } else {
        console.log(`Successfully tracked synced calendar: ${calendarName}`);
      }
    } catch (error) {
      console.error('Error tracking synced calendar:', error);
      throw error;
    }
  }

  // Get user's synced calendars
  async getSyncedCalendars(userId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('synced_calendars')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching synced calendars:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching synced calendars:', error);
      return [];
    }
  }

  // Unsync a calendar (remove synced calendar record and optionally remove events)
  async unsyncCalendar(
    userId: string, 
    calendarId: string, 
    removeEvents: boolean = false
  ): Promise<void> {
    try {
      // Remove the synced calendar record
      const { error: calendarError } = await supabase
        .from('synced_calendars')
        .delete()
        .eq('user_id', userId)
        .eq('google_calendar_id', calendarId);

      if (calendarError) {
        console.error('Error removing synced calendar record:', calendarError);
        throw calendarError;
      }

      // Optionally remove all events from this calendar
      if (removeEvents) {
        const { error: eventsError } = await supabase
          .from('events')
          .delete()
          .eq('user_id', userId)
          .eq('google_calendar_id', calendarId);

        if (eventsError) {
          console.error('Error removing synced events:', eventsError);
          throw eventsError;
        }

        console.log(`Successfully removed synced calendar and ${calendarId} events`);
      } else {
        console.log(`Successfully removed synced calendar record for ${calendarId}`);
      }
    } catch (error) {
      console.error('Error unsyncing calendar:', error);
      throw error;
    }
  }

  // Get specific calendar info
  async getCalendarInfo(calendarId: string): Promise<GoogleCalendar | null> {
    try {
      const calendars = await this.getCalendars();
      return calendars.find(cal => cal.id === calendarId) || null;
    } catch (error) {
      console.error('Error getting calendar info:', error);
      return null;
    }
  }
}

export const googleCalendarService = new GoogleCalendarService(); 