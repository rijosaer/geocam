import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '@/drizzle/migrations';
import { db } from '@/db/client';
import { photosRepo } from '@/db/repositories/photos';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { persistOptions, queryClient, useAppFocusManager } from '@/lib/queryClient';

function RootNavigator() {
  const { session, isLoading } = useAuth();

  if (isLoading) return <View style={{ flex: 1, backgroundColor: '#0a0a0a' }} />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="foto/[id]" options={{ headerShown: true, title: 'Foto' }} />
        <Stack.Screen
          name="sincronizacion"
          options={{ headerShown: true, title: 'Sincronización' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useAppFocusManager(); // TanStack Query se entera de cuándo la app vuelve a primer plano
  const { success, error } = useMigrations(db, migrations);
  const [localReady, setLocalReady] = useState(false);

  // Después de migrar, las fotos de la semana 7 reciben sus campos de sincronización
  useEffect(() => {
    if (!success) return;
    photosRepo
      .ensureSyncFields()
      .catch((e) => console.warn('No se pudieron preparar los campos de sincronización', e))
      .finally(() => setLocalReady(true));
  }, [success]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text>Error al preparar la base de datos: {error.message}</Text>
      </View>
    );
  }

  // Ninguna pantalla se monta antes de que la base esté migrada
  if (!success || !localReady) {
    return <ActivityIndicator style={{ flex: 1 }} />;
  }

  // La caché del feed de la nube se guarda y se restaura al abrir (C3)
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
