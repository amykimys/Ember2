# Google Calendar Integration Setup Guide

This guide will help you set up Google Calendar integration for your React Native app.

## Prerequisites

- Google Cloud Console account
- React Native project with Expo
- Google Calendar API enabled

## Step 1: Set up Google Cloud Console

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click on it and press "Enable"

## Step 2: Configure OAuth Consent Screen

**CRITICAL**: This step is required to fix 403 errors!

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type (unless you have a Google Workspace account)
3. Fill in the required information:
   - **App name**: "Jaani" (or your app name)
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click "Save and Continue"
5. On "Scopes" page, click "Add or Remove Scopes"
6. Add these scopes:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
7. Click "Save and Continue"
8. On "Test users" page, add your email address as a test user
9. Click "Save and Continue"
10. Review and click "Back to Dashboard"

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "iOS" as the application type
4. Fill in the required information:
   - **Bundle ID**: `com.yunseokim.jani` (from your app.json)
   - **App Store ID**: (optional)
5. Click "Create"
6. Copy the **Client ID** - you'll need this for the next step

## Step 4: Create Web Client ID (Required for React Native)

1. In the same Credentials page, click "Create Credentials" > "OAuth 2.0 Client IDs"
2. Choose "Web application" as the application type
3. Fill in the required information:
   - **Name**: "Jaani Web Client"
   - **Authorized JavaScript origins**: Add `https://auth.expo.io`
   - **Authorized redirect URIs**: Add `https://auth.expo.io/@amykimys/Jaani`
4. Click "Create"
5. Copy the **Client ID** - this is your web client ID

## Step 5: Update Configuration

1. Open `utils/googleCalendar.ts`
2. Replace the client IDs with your actual IDs:
   ```typescript
   GoogleSignin.configure({
     webClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com',
     iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
     offlineAccess: true,
     scopes: [
       'https://www.googleapis.com/auth/calendar',
       'https://www.googleapis.com/auth/calendar.events',
       'https://www.googleapis.com/auth/calendar.readonly',
       'https://www.googleapis.com/auth/userinfo.email',
       'https://www.googleapis.com/auth/userinfo.profile'
     ]
   });
   ```

## Step 6: Configure iOS URL Scheme

Update your `app.json` with the correct iOS client ID:
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "CFBundleURLTypes": [
          {
            "CFBundleURLSchemes": [
              "com.googleusercontent.apps.YOUR_IOS_CLIENT_ID"
            ]
          }
        ]
      }
    },
    "plugins": [
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.YOUR_IOS_CLIENT_ID",
          "iosClientId": "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com"
        }
      ]
    ]
  }
}
```

## Step 7: Test the Integration

1. Build and run your app
2. Navigate to the Calendar screen
3. Tap the Google Calendar sync button (Google logo icon)
4. Sign in with your Google account (use the email you added as a test user)
5. Grant calendar permissions
6. Select calendars to sync
7. Tap "Sync" to import events

## Troubleshooting 403 Errors

### Common Causes and Solutions

1. **OAuth Consent Screen Not Configured**
   - **Symptom**: 403 error with "access_denied" or "insufficient_permissions"
   - **Solution**: Complete Step 2 above - configure the OAuth consent screen

2. **User Not Added as Test User**
   - **Symptom**: 403 error when trying to sign in
   - **Solution**: Add your email to the test users list in OAuth consent screen

3. **Wrong Client IDs**
   - **Symptom**: 403 error or authentication failures
   - **Solution**: Verify you're using the correct web client ID and iOS client ID

4. **Calendar API Not Enabled**
   - **Symptom**: 403 error with "API not enabled"
   - **Solution**: Enable Google Calendar API in Google Cloud Console

5. **Scopes Not Added to Consent Screen**
   - **Symptom**: 403 error when accessing calendars
   - **Solution**: Add all required scopes to the OAuth consent screen

### Debug Steps

1. **Check Console Logs**: The updated code now includes detailed logging
2. **Verify Token**: Check if access token is being obtained
3. **Test API Directly**: Use the Google Calendar API Explorer to test your credentials
4. **Check Permissions**: Ensure your Google account has calendars

### Quick Fix Checklist

- [ ] Google Calendar API enabled
- [ ] OAuth consent screen configured
- [ ] All required scopes added to consent screen
- [ ] Your email added as test user
- [ ] Correct web client ID in code
- [ ] Correct iOS client ID in code and app.json
- [ ] URL schemes properly configured

## Features

### What's Included

- **Google Sign-In**: Secure authentication with Google accounts
- **Calendar Selection**: Choose which calendars to sync
- **Event Import**: Import events from selected calendars
- **Real-time Sync**: Sync events for the next 30 days
- **Error Handling**: Comprehensive error handling and user feedback
- **Confirmation Dialog**: Users are asked to confirm before syncing

### API Methods Available

- `signIn()`: Authenticate with Google
- `signOut()`: Sign out from Google
- `isSignedIn()`: Check authentication status
- `getCalendars()`: Get user's calendars
- `getEvents()`: Get events from a calendar
- `createEvent()`: Create new events
- `updateEvent()`: Update existing events
- `deleteEvent()`: Delete events
- `syncEventsToApp()`: Sync events to your app

## Security Considerations

1. **OAuth 2.0**: Uses secure OAuth 2.0 authentication
2. **Token Management**: Automatically handles access tokens
3. **Scope Limitation**: Only requests necessary calendar permissions
4. **Secure Storage**: Tokens are stored securely by Google Sign-In

## Next Steps

After successful integration, you can:

1. **Transform Events**: Modify the `syncEventsToApp()` method to transform Google Calendar events to your app's format
2. **Bidirectional Sync**: Implement two-way sync to create/update events in Google Calendar
3. **Real-time Updates**: Set up webhooks for real-time calendar updates
4. **Multiple Accounts**: Support multiple Google accounts
5. **Offline Support**: Cache events for offline access

## Support

For issues with Google Calendar API:
- [Google Calendar API Documentation](https://developers.google.com/calendar)
- [Google Sign-In Documentation](https://developers.google.com/identity/sign-in/ios)

For issues with the React Native implementation:
- [@react-native-google-signin/google-signin](https://github.com/react-native-google-signin/google-signin)
- [Expo Auth Session](https://docs.expo.dev/versions/latest/sdk/auth-session/) 