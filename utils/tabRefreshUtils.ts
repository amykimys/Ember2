// Tab refresh event system
type TabRefreshCallback = () => void;

class TabRefreshManager {
  private listeners: Map<string, TabRefreshCallback> = new Map();

  // Register a callback for a specific tab
  registerCallback(tabName: string, callback: TabRefreshCallback) {
    this.listeners.set(tabName, callback);
  }

  // Unregister a callback for a specific tab
  unregisterCallback(tabName: string) {
    this.listeners.delete(tabName);
  }

  // Trigger refresh for a specific tab
  triggerRefresh(tabName: string) {
    const callback = this.listeners.get(tabName);
    if (callback) {
      console.log(`🔄 Triggering refresh for ${tabName} tab`);
      callback();
    } else {
      console.log(`⚠️ No refresh callback registered for ${tabName} tab`);
    }
  }

  // Get all registered tab names
  getRegisteredTabs(): string[] {
    return Array.from(this.listeners.keys());
  }

  // Clear all listeners
  clear() {
    this.listeners.clear();
  }
}

// Global instance
export const tabRefreshManager = new TabRefreshManager();

// Hook to use in screens
export const useTabRefresh = (tabName: string, refreshCallback: TabRefreshCallback) => {
  const { useEffect } = require('react');
  
  useEffect(() => {
    // Register the callback
    tabRefreshManager.registerCallback(tabName, refreshCallback);
    
    // Cleanup on unmount
    return () => {
      tabRefreshManager.unregisterCallback(tabName);
    };
  }, [tabName, refreshCallback]);
};

// Function to trigger refresh from tab component
export const triggerTabRefresh = (tabName: string) => {
  tabRefreshManager.triggerRefresh(tabName);
}; 