import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { supabase } from '../supabase';

// Google Sign-In is configured in supabase.ts with calendar scopes

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
  backgroundColor?: string;
  foregroundColor?: string;
}

class GoogleCalendarService {
  private accessToken: string | null = null;

  // Sign in with Google
  async signIn(): Promise<boolean> {
    try {
      await GoogleSignin.hasPlayServices();
      
      // Sign out first to ensure fresh authentication with proper scopes
      await GoogleSignin.signOut();
      
      console.log('Starting Google Sign-In with calendar scopes...');
      const userInfo = await GoogleSignin.signIn();
      console.log('Google Sign-In successful');
      
      const tokens = await GoogleSignin.getTokens();
      this.accessToken = tokens.accessToken;
      console.log('Access token obtained, length:', this.accessToken?.length);
      
      // Test if the token has calendar permissions
      const hasCalendarAccess = await this.testCalendarAccess();
      if (!hasCalendarAccess) {
        console.warn('Token obtained but calendar access not confirmed. User may need to grant calendar permissions.');
      }
      
      return true;
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('SIGN_IN_CANCELLED')) {
          throw new Error('Sign-in was cancelled by the user');
        } else if (error.message.includes('SIGN_IN_REQUIRED')) {
          throw new Error('Sign-in is required. Please try again.');
        } else if (error.message.includes('NETWORK_ERROR')) {
          throw new Error('Network error. Please check your internet connection and try again.');
        }
      }
      
      return false;
    }
  }

  // Test if the current token has calendar access
  private async testCalendarAccess(): Promise<boolean> {
    try {
      if (!this.accessToken) {
        return false;
      }

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1',
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Calendar access test failed:', error);
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
      console.log('Forcing complete re-authentication to get proper scopes...');
      
      // Clear the current access token
      this.accessToken = null;
      
      // Sign out completely to clear any cached tokens
      await GoogleSignin.signOut();
      
      // Wait a moment to ensure sign-out is complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Force a new sign-in which should prompt for calendar permissions
      console.log('Starting fresh sign-in with calendar scopes...');
      const userInfo = await GoogleSignin.signIn();
      console.log('Re-authentication successful');
      
      const tokens = await GoogleSignin.getTokens();
      this.accessToken = tokens.accessToken;
      console.log('New access token obtained, length:', this.accessToken?.length);
      
      // Test calendar access with the new token
      const hasCalendarAccess = await this.testCalendarAccess();
      if (hasCalendarAccess) {
        console.log('Calendar access confirmed with new token');
        return true;
      } else {
        console.warn('Calendar access still not available after re-authentication');
        return false;
      }
    } catch (error) {
      console.error('Re-authentication Error:', error);
      return false;
    }
  }

  // Force complete OAuth reset by revoking tokens
  async forceOAuthReset(): Promise<boolean> {
    try {
      console.log('Forcing complete OAuth reset...');
      
      // Get current tokens before signing out
      let currentTokens = null;
      try {
        currentTokens = await GoogleSignin.getTokens();
      } catch (e) {
        console.log('No current tokens to revoke');
      }
      
      // Revoke tokens if we have them
      if (currentTokens?.accessToken) {
        try {
          console.log('Revoking current access token...');
          await fetch(`https://oauth2.googleapis.com/revoke?token=${currentTokens.accessToken}`, {
            method: 'POST',
          });
          console.log('Access token revoked successfully');
        } catch (revokeError) {
          console.warn('Failed to revoke token:', revokeError);
        }
      }
      
      // Clear the current access token
      this.accessToken = null;
      
      // Sign out completely to clear any cached tokens
      await GoogleSignin.signOut();
      
      // Wait a moment to ensure sign-out is complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force a completely fresh sign-in
      console.log('Starting completely fresh sign-in with calendar scopes...');
      const userInfo = await GoogleSignin.signIn();
      console.log('Fresh sign-in successful');
      
      const tokens = await GoogleSignin.getTokens();
      this.accessToken = tokens.accessToken;
      console.log('New access token obtained, length:', this.accessToken?.length);
      
      // Test calendar access with the new token
      const hasCalendarAccess = await this.testCalendarAccess();
      if (hasCalendarAccess) {
        console.log('Calendar access confirmed with fresh token');
        return true;
      } else {
        console.warn('Calendar access still not available after OAuth reset');
        return false;
      }
    } catch (error) {
      console.error('OAuth Reset Error:', error);
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

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Calendar API error response:', errorText);
        
        if (response.status === 403) {
          // Check if it's a scope issue
          if (errorText.includes('insufficientPermissions') || errorText.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')) {
            console.log('Calendar scopes not granted. Attempting re-authentication...');
            
            // Try to re-authenticate automatically
            const reAuthSuccess = await this.reAuthenticate();
            if (reAuthSuccess) {
              // Retry the request with the new token
              return await this.getCalendars();
            } else {
              throw new Error('403: Insufficient permissions - calendar scopes not granted. Please sign out and sign in again to grant calendar permissions.');
            }
          }
        }
        
        throw new Error(`Calendar API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Calendars fetched successfully:', data.items?.length || 0, 'calendars');
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
    userId?: string,
    customColor?: string
  ): Promise<any[]> {
    try {
      const events = await this.getEvents(calendarId, timeMin, timeMax);
      
      // Use custom color if provided, otherwise get calendar info to get the color
      let calendarColor = customColor;
      if (!calendarColor) {
        const calendar = await this.getCalendarInfo(calendarId);
        calendarColor = calendar?.backgroundColor || '#4285F4'; // Default to Google blue if no color
      }

      // Transform Google Calendar events to your app's format
      const transformedEvents = events.map(event => {
        // Determine if it's an all-day event
        const isAllDay = !event.start.dateTime && !event.end.dateTime;
        
        let startDate, endDate, eventDate;
        
        if (isAllDay) {
          // For all-day events, use the date string directly to avoid timezone issues
          eventDate = event.start.date!; // This is already in YYYY-MM-DD format
          
          // For all-day events, we don't need to create Date objects for start/end times
          // since they should be treated as all-day events in the app
          startDate = undefined;
          endDate = undefined;
        } else {
          // For timed events, parse the datetime normally
          startDate = new Date(event.start.dateTime!);
          endDate = new Date(event.end.dateTime!);
          eventDate = startDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        }

        // Create the transformed event
        const transformedEvent = {
          id: `google_${event.id}`, // Prefix to avoid conflicts
          title: event.summary || 'Untitled Event',
          description: event.description || '',
          location: event.location || '',
          date: eventDate,
          startDateTime: startDate,
          endDateTime: endDate,
          isAllDay: isAllDay,
          categoryName: 'Google Calendar',
          categoryColor: calendarColor, // Use calendar's background color
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
          calendarColor: calendarColor, // Store the calendar color
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
            calendar.primary,
            customColor || calendar.backgroundColor, // Use custom color if provided
            calendar.foregroundColor
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
            start_datetime: event.startDateTime ? event.startDateTime.toISOString() : null,
            end_datetime: event.endDateTime ? event.endDateTime.toISOString() : null,
            is_all_day: event.isAllDay,
            category_name: event.categoryName,
            category_color: event.categoryColor,
            google_calendar_id: event.googleCalendarId,
            google_event_id: event.googleEventId,
            is_google_event: event.isGoogleEvent,
            calendar_color: event.calendarColor,
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
    isPrimary: boolean = false,
    backgroundColor?: string,
    foregroundColor?: string
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
          background_color: backgroundColor,
          foreground_color: foregroundColor,
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

  // Update synced calendar color
  async updateSyncedCalendarColor(
    syncedCalendarId: string,
    newColor: string
  ): Promise<void> {
    try {
      // First, get the synced calendar to find the google_calendar_id
      const { data: syncedCalendar, error: calendarError } = await supabase
        .from('synced_calendars')
        .select('google_calendar_id')
        .eq('id', syncedCalendarId)
        .single();

      if (calendarError) {
        console.error('Error fetching synced calendar:', calendarError);
        throw calendarError;
      }

      // Update the synced calendar record
      const { error: updateError } = await supabase
        .from('synced_calendars')
        .update({
          background_color: newColor,
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', syncedCalendarId);

      if (updateError) {
        console.error('Error updating synced calendar color:', updateError);
        throw updateError;
      }

      // Update all events from this calendar to use the new color
      const { error: eventsError } = await supabase
        .from('events')
        .update({
          category_color: newColor,
          calendar_color: newColor,
        })
        .eq('google_calendar_id', syncedCalendar.google_calendar_id);

      if (eventsError) {
        console.error('Error updating events color:', eventsError);
        throw eventsError;
      }

      console.log(`Successfully updated synced calendar color to ${newColor} and updated all events`);
    } catch (error) {
      console.error('Error updating synced calendar color:', error);
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