import { Text } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { GeoPhotosProvider } from '@/context/GeoPhotosContext';

export default function TabsLayout() {
  return (
    <GeoPhotosProvider>
      <Tabs screenOptions={{ tabBarActiveTintColor: '#10b981' }}>
        <Tabs.Screen
          name="geocam"
          options={{
            title: 'GeoCam',
            headerShown: false,
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📷</Text>,
          }}
        />
        <Tabs.Screen
          name="mapa"
          options={{
            title: 'Mapa',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🗺️</Text>,
          }}
        />
      </Tabs>
    </GeoPhotosProvider>
  );
}
