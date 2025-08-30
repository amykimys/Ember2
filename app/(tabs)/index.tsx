import { Redirect } from 'expo-router';

export default function InitialRouting() {
  return <Redirect href="/(tabs)/todo" />;
}