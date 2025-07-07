# Shared Notes Feature

This feature allows users to share notes with friends and collaborate on them in real-time.

## Features

### 1. Note Sharing
- Share notes with multiple friends at once
- Control whether friends can edit the note or just view it
- Real-time notifications when notes are shared

### 2. Real-time Collaboration
- See who is currently editing a note
- Real-time cursor position tracking
- Live updates when others make changes
- Conflict resolution with version history

### 3. Access Control
- Accept or decline shared notes
- View pending shared note requests
- Manage shared note permissions

## Database Structure

### Tables

1. **shared_notes** - Tracks shared note relationships
   - `id` - Unique identifier
   - `original_note_id` - Reference to the original note
   - `shared_by` - User who shared the note
   - `shared_with` - User the note was shared with
   - `status` - 'pending', 'accepted', or 'declined'
   - `can_edit` - Whether the recipient can edit the note

2. **note_collaborators** - Tracks active collaboration sessions
   - `id` - Unique identifier
   - `note_id` - Reference to the note being collaborated on
   - `user_id` - User who is collaborating
   - `is_editing` - Whether the user is currently editing
   - `cursor_position` - Current cursor position in the note
   - `last_activity` - Timestamp of last activity

3. **note_versions** - Version history for conflict resolution
   - `id` - Unique identifier
   - `note_id` - Reference to the note
   - `user_id` - User who created this version
   - `title` - Note title at this version
   - `content` - Note content at this version
   - `version_number` - Sequential version number

## API Functions

### Sharing Functions
- `share_note_with_friends(note_id, friend_ids, can_edit)` - Share a note with friends
- `accept_shared_note(shared_note_id)` - Accept a shared note
- `decline_shared_note(shared_note_id)` - Decline a shared note

### Query Functions
- `get_shared_notes_for_user(user_id)` - Get all accepted shared notes for a user
- `get_pending_shared_notes(user_id)` - Get pending shared note requests

### Collaboration Functions
- `update_note_collaboration(note_id, is_editing, cursor_position)` - Update collaboration status
- `remove_note_collaboration(note_id)` - Remove collaboration status
- `get_note_collaborators(note_id)` - Get active collaborators for a note

### Version Functions
- `create_note_version(note_id, title, content)` - Create a new version of a note

## Usage

### Sharing a Note
1. Open a note in the notes screen
2. Swipe left on the note to reveal the share button
3. Tap the share button (blue icon)
4. Select friends from the list
5. Choose whether they can edit the note
6. Tap "Share" to send the invitation

### Accepting a Shared Note
1. Look for the mail icon in the notes header
2. If there's a red badge, you have pending shared notes
3. Tap the mail icon to view pending requests
4. Tap "Accept" to add the note to your notes list
5. Tap "Decline" to reject the invitation

### Viewing Shared Notes
1. Tap the people icon in the notes header
2. View all notes shared with you
3. Tap on a shared note to open it

### Real-time Collaboration
- When someone opens a shared note, they appear as an active collaborator
- You can see their cursor position in real-time
- Changes are automatically saved and synced
- Version history is maintained for conflict resolution

## Security

- Row Level Security (RLS) policies ensure users can only access notes they own or have been shared with
- All functions are secured with proper authentication checks
- Users can only edit notes they own or have explicit edit permissions for

## Setup

1. Run the `create_shared_notes_system.sql` script in your Supabase SQL editor
2. The script will create all necessary tables, functions, and policies
3. Test the setup using the `test_shared_notes.sql` script

## Real-time Features

The system uses Supabase's real-time subscriptions to provide:
- Live updates when notes are shared
- Real-time collaboration status
- Instant synchronization of note changes
- Active collaborator indicators

## Error Handling

- Graceful handling of network errors
- Optimistic updates with rollback on failure
- User-friendly error messages
- Automatic retry mechanisms for failed operations 