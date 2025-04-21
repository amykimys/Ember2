import { useRootNavigationState, Redirect } from 'expo-router';
import 'react-native-reanimated';


export default function InitalRouting() {
  const rootNavigationState = useRootNavigationState();


  if (!rootNavigationState?.key) return null;


  return <Redirect href={'/(tabs)/HomeScreen'} />
}