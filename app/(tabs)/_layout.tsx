import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useTabBar } from '../../contexts/TabBarContext';

export default function TabLayout() {
  const { isPhotoZoomed } = useTabBar();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#00ACC1', // Turquoise color for selected items
        tabBarInactiveTintColor: '#94a3b8', // Muted color for unselected items
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          borderTopColor: '#e2e8f0',
          paddingBottom: 2,
          paddingTop: 2,
          height: 75,
          position: 'absolute',
          bottom: 0,
          display: isPhotoZoomed ? 'none' : 'flex', // Hide tab bar when photo is zoomed
        },
        tabBarLabelStyle: {
          fontFamily: 'Onest',
          fontSize: 12,
          fontWeight: '500',
        },
      }}>
      <Tabs.Screen
        name="todo"
        options={{
          title: 'Todo',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: 'Notes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends-feed"
        options={{
          title: 'Feed',
                      tabBarIcon: ({ color, size }) => (
              <Ionicons name="heart-outline" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen redirect name="index" />
    </Tabs>
  );
}