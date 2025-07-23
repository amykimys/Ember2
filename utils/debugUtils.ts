// Debug utilities for tracking app reopen issues

interface DebugInfo {
  timestamp: string;
  event: string;
  details: any;
  sessionState?: any;
  dataState?: any;
  networkState?: any;
}

class AppDebugger {
  private logs: DebugInfo[] = [];
  private maxLogs = 100;

  log(event: string, details: any = {}, additionalInfo?: {
    sessionState?: any;
    dataState?: any;
    networkState?: any;
  }) {
    const logEntry: DebugInfo = {
      timestamp: new Date().toISOString(),
      event,
      details,
      ...additionalInfo
    };

    this.logs.push(logEntry);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    console.log(`🔍 [DEBUG] ${event}:`, details);
  }

  getLogs(): DebugInfo[] {
    return [...this.logs];
  }

  getRecentLogs(count: number = 10): DebugInfo[] {
    return this.logs.slice(-count);
  }

  clearLogs() {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Specific logging methods for common events
  logAppOpen() {
    this.log('APP_OPEN', {
      time: new Date().toISOString(),
      platform: 'react-native'
    });
  }

  logAppClose() {
    this.log('APP_CLOSE', {
      time: new Date().toISOString()
    });
  }

  logSessionChange(session: any) {
    this.log('SESSION_CHANGE', {
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
      expiresAt: session?.expires_at
    }, {
      sessionState: session
    });
  }

  logDataRefresh(success: boolean, error?: any) {
    this.log('DATA_REFRESH', {
      success,
      error: error?.message || null,
      time: new Date().toISOString()
    });
  }

  logNetworkChange(isConnected: boolean, type?: string) {
    this.log('NETWORK_CHANGE', {
      isConnected,
      type,
      time: new Date().toISOString()
    }, {
      networkState: { isConnected, type }
    });
  }

  logError(error: any, context: string) {
    this.log('ERROR', {
      context,
      message: error?.message || 'Unknown error',
      stack: error?.stack || null,
      time: new Date().toISOString()
    });
  }
}

// Global debugger instance
export const appDebugger = new AppDebugger();

// Utility function to check app health
export const checkAppHealth = async () => {
  const health = {
    timestamp: new Date().toISOString(),
    session: null as any,
    network: null as any,
    dataContext: null as any,
    errors: [] as string[]
  };

  try {
    // Check session
    const { supabase } = require('../supabase');
    const { data: { session } } = await supabase.auth.getSession();
    health.session = {
      hasSession: !!session,
      userId: session?.user?.id,
      isExpired: session?.expires_at ? new Date(session.expires_at * 1000) < new Date() : false
    };
  } catch (error) {
    health.errors.push(`Session check failed: ${error}`);
  }

  try {
    // Check network
    const { checkNetworkConnectivity } = require('./networkUtils');
    health.network = await checkNetworkConnectivity();
  } catch (error) {
    health.errors.push(`Network check failed: ${error}`);
  }

  return health;
};

// Utility to get debug info for troubleshooting
export const getDebugInfo = () => {
  return {
    logs: appDebugger.getRecentLogs(20),
    health: checkAppHealth(),
    timestamp: new Date().toISOString()
  };
}; 