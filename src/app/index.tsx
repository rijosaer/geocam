import { ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const { session, isLoading } = useAuth();

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} />;

  // Fuera de los dos grupos protegidos: manda al usuario a donde le corresponde
  return <Redirect href={session ? '/geocam' : '/login'} />;
}
