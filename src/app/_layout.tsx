import { ActivityIndicator, Text, View } from 'react-native';
import { Slot } from 'expo-router';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '@/drizzle/migrations';
import { db } from '@/db/client';

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text>Error al preparar la base de datos: {error.message}</Text>
      </View>
    );
  }

  // Ninguna pantalla se monta antes de que la base esté migrada
  if (!success) {
    return <ActivityIndicator style={{ flex: 1 }} />;
  }

  return <Slot />;
}
