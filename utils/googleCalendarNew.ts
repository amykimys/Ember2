import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { supabase } from '../supabase';

// Types
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

export interface SyncedCalendar {
  id: string;
  user_id: string;
  google_calendar_id: string;
  calendar_name: string;
  calendar_description?: string;
  is_primary: boolean;
  background_color: string;
  foreground_color: string;
  created_at: string;
  updated_at: string;
}

class GoogleCalendarService {
  private accessToken: string | null = null;
  private isInitialized = false;

  // Initialize the service
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Configure Google Sign-In with calendar scopes
      GoogleSignin.configure({
        iosClientId: '407418160129-8u96bsrh8j1madb0r7trr0k6ci327gds.apps.googleusercontent.com',
        webClientId: '407418160129-8u96bsrh8j1madb0r7trr0k6ci327gds.apps.googleusercontent.com',
        offlineAccess: true,
        forceCodeForRefreshToken: true,
        scopes: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile'
        ]
      });

      this.isInitialized = true;
      console.log('Google Calendar Service initialized');
    } catch (error) {
      console.error('Failed to initialize Google Calendar Service:', error);
      throw error;
    }
  }

  // Check if user is signed in
  async isSignedIn(): Promise<boolean> {
    try {
      await this.initialize();
      
      const currentUser = await GoogleSignin.getCurrentUser();
      if (currentUser) {
        const tokens = await GoogleSignin.getTokens();
        this.accessToken = tokens.accessToken;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking sign-in status:', error);
      return false;
    }
  }

  // Sign in with Google
  async signIn(): Promise<boolean> {
    try {
      await this.initialize();
      
      // Sign out first to ensure fresh authentication
      await GoogleSignin.signOut();
      
      console.log('Starting Google Sign-In with calendar scopes...');
      const userInfo = await GoogleSignin.signIn();
      console.log('Google Sign-In successful');
      
      const tokens = await GoogleSignin.getTokens();
      this.accessToken = tokens.accessToken;
      console.log('Access token obtained, length:', this.accessToken?.length);
      
      // Test calendar access
      const hasAccess = await this.testCalendarAccess();
      if (!hasAccess) {
        console.warn('Calendar access not confirmed after sign-in - user may need to grant calendar permissions');
        // Don't return false here, as the user might still be able to use the app
        // The calendar access will be tested when they try to use calendar features
      } else {
        console.log('Calendar access confirmed');
      }
      
      return true;
    } catch (error) {
      console.error('Google Sign-In failed:', error);
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
      console.error('Google Sign-Out failed:', error);
    }
  }

  // Force complete OAuth reset
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

  // Test calendar access
  private async testCalendarAccess(): Promise<boolean> {
    try {
      if (!this.accessToken) return false;

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

  // Get user's calendars
  async getCalendars(): Promise<GoogleCalendar[]> {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available. Please sign in to Google Calendar first.');
      }

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        
        // Check if it's a scope/permission error
        if (response.status === 403 && (
          errorData.error?.message?.includes('insufficient authentication scopes') ||
          errorData.error?.message?.includes('insufficientPermissions') ||
          errorData.error?.message?.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')
        )) {
          throw new Error('Calendar permissions not granted. Please sign out and sign back in to grant calendar access permissions.');
        }
        
        throw new Error(`Calendar API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Failed to get calendars:', error);
      throw error;
    }
  }

  // Get events from a calendar
  async getEvents(
    calendarId: string = 'primary',
    timeMin?: string,
    timeMax?: string,
    maxResults: number = 100
  ): Promise<GoogleCalendarEvent[]> {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available');
      }

      const params = new URLSearchParams({
        maxResults: maxResults.toString(),
        singleEvents: 'true',
        orderBy: 'startTime',
      });

      if (timeMin) params.append('timeMin', timeMin);
      if (timeMax) params.append('timeMax', timeMax);

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
        const errorData = await response.json();
        throw new Error(`Calendar API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Failed to get events:', error);
      throw error;
    }
  }

  // Sync events to app database
  async syncEventsToApp(
    calendarId: string = 'primary',
    timeMin?: string,
    timeMax?: string,
    userId?: string,
    customColor?: string
  ): Promise<any[]> {
    try {
      if (!userId) {
        throw new Error('User ID is required for syncing events');
      }

      console.log(`Syncing events from calendar: ${calendarId}`);
      
      // Get events from Google Calendar
      const events = await this.getEvents(calendarId, timeMin, timeMax, 2500);
      console.log(`Found ${events.length} events to sync`);

      // Transform events for database
      const transformedEvents = events.map(event => ({
        id: event.id,
        title: event.summary || 'Untitled Event',
        description: event.description || '',
        location: event.location || '',
        start_time: event.start.dateTime || event.start.date,
        end_time: event.end.dateTime || event.end.date,
        all_day: !event.start.dateTime,
        color: customColor || '#4285F4',
        google_calendar_id: calendarId,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      // Save events to database
      const { data, error } = await supabase
        .from('events')
        .upsert(transformedEvents, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        console.error('Failed to save events to database:', error);
        throw error;
      }

      console.log(`Successfully synced ${data?.length || 0} events`);
      return data || [];
    } catch (error) {
      console.error('Failed to sync events:', error);
      throw error;
    }
  }

  // Track synced calendar in database
  async trackSyncedCalendar(
    userId: string,
    calendarId: string,
    calendarName: string,
    calendarDescription?: string,
    isPrimary: boolean = false,
    backgroundColor: string = '#4285F4',
    foregroundColor: string = '#ffffff'
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
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_id,google_calendar_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('Failed to track synced calendar:', error);
        throw error;
      }

      console.log(`Calendar ${calendarName} tracked successfully`);
    } catch (error) {
      console.error('Failed to track synced calendar:', error);
      throw error;
    }
  }

  // Get synced calendars from database
  async getSyncedCalendars(userId: string): Promise<SyncedCalendar[]> {
    try {
      const { data, error } = await supabase
        .from('synced_calendars')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to get synced calendars:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to get synced calendars:', error);
      throw error;
    }
  }

  // Update synced calendar color
  async updateSyncedCalendarColor(
    syncedCalendarId: string,
    newColor: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('synced_calendars')
        .update({
          background_color: newColor,
          updated_at: new Date().toISOString()
        })
        .eq('id', syncedCalendarId);

      if (error) {
        console.error('Failed to update calendar color:', error);
        throw error;
      }

      console.log('Calendar color updated successfully');
    } catch (error) {
      console.error('Failed to update calendar color:', error);
      throw error;
    }
  }

  // Unsync calendar
  async unsyncCalendar(
    userId: string,
    calendarId: string,
    removeEvents: boolean = false
  ): Promise<void> {
    try {
      // Remove synced calendar tracking
      const { error: trackingError } = await supabase
        .from('synced_calendars')
        .delete()
        .eq('user_id', userId)
        .eq('google_calendar_id', calendarId);

      if (trackingError) {
        console.error('Failed to remove calendar tracking:', trackingError);
        throw trackingError;
      }

      // Optionally remove events
      if (removeEvents) {
        const { error: eventsError } = await supabase
          .from('events')
          .delete()
          .eq('user_id', userId)
          .eq('google_calendar_id', calendarId);

        if (eventsError) {
          console.error('Failed to remove events:', eventsError);
          throw eventsError;
        }
      }

      console.log(`Calendar ${calendarId} unsynced successfully`);
    } catch (error) {
      console.error('Failed to unsync calendar:', error);
      throw error;
    }
  }

  // Get calendar info
  async getCalendarInfo(calendarId: string): Promise<GoogleCalendar | null> {
    try {
      if (!this.accessToken) {
        throw new Error('No access token available');
      }

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get calendar info:', error);
      return null;
    }
  }
}

// Export singleton instance
export const googleCalendarService = new GoogleCalendarService(); 