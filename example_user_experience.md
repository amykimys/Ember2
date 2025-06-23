# Example: Friend Sharing a Task with You

## Scenario: Sarah shares a task with you

### Step 1: Sarah creates a task in her app
Sarah opens her Jaani app and creates a new task:

```
Task: Plan weekend trip
Description: Let's plan our weekend camping trip to Big Sur. Need to coordinate dates, food, and equipment.
Due Date: Next week
```

### Step 2: Sarah shares the task with you
Sarah taps on the task, then taps the "Share" button. She sees a list of her friends and selects you from the list.

**What Sarah sees:**
- Her task list with the "Plan weekend trip" task
- A share button that opens her friends list
- Confirmation that the task was shared successfully

### Step 3: You receive the task instantly
**What you see in your app:**
- The task "Plan weekend trip" appears immediately in your task list
- No notifications or modals asking you to accept/decline
- The task is ready to use right away

### Step 4: You can interact with the shared task
You can:
- ✅ Mark it as complete
- 📝 Edit the description
- 📅 Change the due date
- 🏷️ Add it to a category
- 📸 Add photos
- 🔄 Set reminders

### Step 5: Sarah shares another task
Sarah creates and shares a grocery list:

```
Task: Grocery shopping
Description: Milk, bread, eggs, cheese, pasta, tomatoes, chicken breast, rice
Due Date: In 2 days
```

**What you see:**
- Both tasks now appear in your task list
- "Plan weekend trip" (shared by Sarah)
- "Grocery shopping" (shared by Sarah)

## Key Benefits of Auto-Accept

1. **Instant Collaboration**: No waiting for acceptance - tasks appear immediately
2. **Seamless Experience**: No extra steps or notifications to deal with
3. **Better Teamwork**: Friends can start working on shared tasks right away
4. **Reduced Friction**: No need to remember to accept tasks later

## What's Different from Before

**Before (Manual Acceptance):**
- Friend shares task → You get notification → You tap "Review" → You see modal → You tap "Accept" → Task appears in your list

**Now (Auto-Accept):**
- Friend shares task → Task appears in your list immediately ✅

## Real-World Use Cases

1. **Roommates**: "Can you pick up groceries on your way home?"
2. **Couples**: "Let's plan our anniversary dinner"
3. **Friends**: "Help me organize the party this weekend"
4. **Family**: "Mom needs help with errands this week"
5. **Work Teams**: "Let's coordinate the project timeline"

## Behind the Scenes

When Sarah shares a task with you:
1. The app calls `share_task_with_friend()` function
2. Database creates a copy of the task in your todos table
3. Database records the sharing in shared_tasks table (status: 'accepted')
4. Your app fetches tasks and shows the new shared task immediately

## Task Ownership

- **Original task**: Stays in Sarah's list (she can edit/delete it)
- **Your copy**: Independent task in your list (you can edit/delete it)
- **Changes don't sync**: If Sarah edits her task, your copy doesn't change
- **Independent completion**: You can mark yours complete without affecting Sarah's

This design allows for flexible collaboration while maintaining individual task management! 