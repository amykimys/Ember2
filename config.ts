// Environment validation
const requiredEnvVars = {
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
} as const;

// Validate environment variables
const validateEnv = () => {
  const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env file or environment configuration.'
    );
  }
};

// Only validate in production
if (process.env.NODE_ENV === 'production') {
  validateEnv();
}

// Google OAuth Configuration
export const GOOGLE_CONFIG = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? 
    (process.env.NODE_ENV === 'development' 
      ? '407418160129-v3c55fd6db3f8mv747p9q5tsbcmvnrik.apps.googleusercontent.com' // Development fallback
      : (() => { throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is required in production'); })()),
  
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? 
    (process.env.NODE_ENV === 'development'
      ? '407418160129-8u96bsrh8j1madb0r7trr0k6ci327gds.apps.googleusercontent.com' // Development fallback
      : (() => { throw new Error('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is required in production'); })()),
} as const;

// App Configuration
export const CONFIG = {
  google: GOOGLE_CONFIG,
  environment: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;

// Type definitions for better TypeScript support
export type Config = typeof CONFIG;
export type GoogleConfig = typeof GOOGLE_CONFIG; 