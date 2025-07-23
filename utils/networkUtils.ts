import NetInfo from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
}

// Check network connectivity
export const checkNetworkConnectivity = async (): Promise<NetworkStatus> => {
  try {
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected || false,
      isInternetReachable: state.isInternetReachable || false,
      type: state.type || 'unknown'
    };
  } catch (error) {
    console.error('Error checking network connectivity:', error);
    return {
      isConnected: false,
      isInternetReachable: false,
      type: 'unknown'
    };
  }
};

// Retry function with exponential backoff
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Check network connectivity before retrying
      const networkStatus = await checkNetworkConnectivity();
      if (!networkStatus.isConnected) {
        console.log('Network not connected, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, baseDelay * 2));
        continue;
      }
      
      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

// Debounce function to prevent excessive API calls
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T & { cancel: () => void } => {
  let timeout: NodeJS.Timeout;
  
  const debounced = ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T & { cancel: () => void };
  
  debounced.cancel = () => clearTimeout(timeout);
  
  return debounced;
};

// Throttle function to limit API call frequency
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T => {
  let inThrottle: boolean;
  
  return ((...args: any[]) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }) as T;
};

// Check if the app has been inactive for a long time
export const isAppInactiveForLongTime = (lastActiveTime: Date): boolean => {
  const now = new Date();
  const timeDiff = now.getTime() - lastActiveTime.getTime();
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  // Consider app inactive if it's been more than 1 hour
  return hoursDiff > 1;
};

// Store and retrieve last active time
export const updateLastActiveTime = (): void => {
  try {
    const now = new Date().toISOString();
    localStorage.setItem('jaani_last_active_time', now);
  } catch (error) {
    console.error('Error updating last active time:', error);
  }
};

export const getLastActiveTime = (): Date | null => {
  try {
    const lastActive = localStorage.getItem('jaani_last_active_time');
    return lastActive ? new Date(lastActive) : null;
  } catch (error) {
    console.error('Error getting last active time:', error);
    return null;
  }
}; 