import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '../supabase';

export default function LoginCallback() {
  const router = useRouter();

  useEffect(() => {
    const restoreSession = async () => {
      const url = await Linking.getInitialURL();
      console.log('🔗 Received redirect URL:', url);

      if (!url || !url.includes('#')) {
        console.warn('⚠️ No fragment found in URL');
        return;
      }

      // Extract access_token and refresh_token from the fragment
      const fragment = url.split('#')[1];
      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      console.log('🔐 Tokens from fragment:', { access_token, refresh_token });

      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });

        if (error) {
          console.error('❌ Failed to set session:', error.message);
        } else {
          console.log('✅ Session successfully restored:', data.session?.user?.email);
        }
      } else {
        console.warn('❌ Missing tokens in fragment');
      }

      router.replace('/');
    };

    restoreSession();
  }, []);

  return null;
}