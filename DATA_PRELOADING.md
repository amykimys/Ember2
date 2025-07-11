# Data Preloading System

## Overview

The Jaani app now includes a comprehensive data preloading system that fetches all essential app data during the loading screen **for authenticated users only**. This ensures that when signed-in users reach the main app, all data is already available, providing a smoother user experience.

## How It Works

### 1. Authentication-Based Loading

The system behaves differently based on authentication status:

#### **Authenticated Users**
- **Full Data Preloading**: All app data is fetched during loading screen
- **Progress Tracking**: Detailed progress bar with task names
- **Longer Loading Time**: 3+ seconds to ensure all data is ready
- **Immediate Access**: All data available when app loads

#### **Unauthenticated Users**
- **Simple Loading**: Basic loading screen without data fetching
- **Quick Loading**: 1.5 seconds for faster app startup
- **Profile Redirect**: Automatically redirected to profile for authentication
- **No Data Preloading**: Data will be fetched when user signs in

### 2. Loading Screen with Progress

The app shows a custom loading screen with:
- **Progress Bar**: Visual indicator showing data loading progress
- **Current Task**: Text showing what data is currently being loaded
- **Progress Percentage**: Numerical progress indicator
- **Adaptive Loading Time**: Longer for authenticated users, shorter for guests

### 3. Data Preloading Tasks (Authenticated Users Only)

The system preloads the following data in sequence:

1. **User Profile** - Basic user information
2. **User Preferences** - App settings and preferences
3. **Categories** - User's task categories
4. **Tasks & Habits** - All todos and habits
5. **Calendar Events** - All calendar events
6. **Shared Events** - Events shared with/by the user
7. **Notes** - User's notes
8. **Shared Notes** - Notes shared with/by the user
9. **Friends & Requests** - Friends list and friend requests
10. **Social Updates** - Friends feed updates
11. **Auto-move Tasks** - Processes any tasks that need to be moved
12. **Finalizing** - Brief pause to complete the loading

### 4. Data Context

All preloaded data is stored in a React Context (`DataContext`) that provides:
- **Global Access**: Any component can access preloaded data
- **Type Safety**: Full TypeScript support for all data types
- **Real-time Updates**: Data can be updated and shared across components
- **Performance**: Eliminates redundant API calls

## Usage in Components

### Accessing Preloaded Data

```typescript
import { useData } from '../../contexts/DataContext';

function MyComponent() {
  const { data: appData } = useData();
  
  // Access preloaded data
  const { todos, habits, events, notes, friends } = appData;
  
  // Check if data is preloaded
  if (appData.isPreloaded) {
    // Use preloaded data
    console.log('Data is ready:', todos.length, 'todos');
  } else {
    // Fallback to normal data fetching
    console.log('No preloaded data - fetching normally');
  }
}
```

### Updating Data

```typescript
import { useData } from '../../contexts/DataContext';

function MyComponent() {
  const { updateData } = useData();
  
  const addNewTodo = async (todo) => {
    // Add to database
    const result = await supabase.from('todos').insert(todo);
    
    // Update local context
    updateData('todos', [...appData.todos, result.data]);
  };
}
```

## Benefits

### 1. Improved Performance
- **Faster Navigation**: No loading delays when switching tabs
- **Reduced API Calls**: Data is fetched once during app startup
- **Better UX**: Users see content immediately

### 2. Better User Experience
- **Visual Feedback**: Progress bar shows loading status
- **Predictable Loading**: Consistent loading time
- **No Empty States**: Data is ready when screens load
- **Quick Guest Access**: Unauthenticated users get fast access

### 3. Reduced Server Load
- **Batch Loading**: All data fetched in one session
- **Caching**: Data stays in memory during app session
- **Efficient Queries**: Optimized database queries

## Configuration

### Loading Time
The minimum loading time can be adjusted in `components/LoadingScreen.tsx`:

```typescript
const minLoadingTime = isSimpleLoading ? 1500 : 3000; // 1.5s for guests, 3s for users
```

### Preloading Tasks
New preloading tasks can be added in `app/_layout.tsx`:

```typescript
const tasks = [
  // ... existing tasks
  { name: 'New Data Type', fn: () => preloadNewDataType(userId) }
];
```

### Data Types
New data types can be added to `contexts/DataContext.tsx`:

```typescript
interface AppData {
  // ... existing properties
  newDataType: NewDataType[];
}
```

## Error Handling

The system includes robust error handling:
- **Graceful Degradation**: App continues even if some data fails to load
- **Error Logging**: Failed preloads are logged for debugging
- **Fallback Loading**: Components can still fetch data if preloading fails
- **Authentication Fallback**: Unauthenticated users get simple loading

## Future Enhancements

Potential improvements:
- **Background Refresh**: Periodically refresh data in background
- **Selective Preloading**: Only preload data for user's default screen
- **Offline Support**: Cache data for offline usage
- **Data Synchronization**: Sync changes across multiple devices
- **Guest Mode**: Allow limited functionality without authentication 