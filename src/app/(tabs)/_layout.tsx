import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { GeoPhotosProvider } from '@/context/GeoPhotosContext';

export default function TabsLayout() {
  return (
    <GeoPhotosProvider>
      <NativeTabs>
        <NativeTabs.Trigger name="geocam">
          <NativeTabs.Trigger.Label>GeoCam</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="camera.fill" md="photo_camera" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="mapa">
          <NativeTabs.Trigger.Label>Mapa</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="map.fill" md="map" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </GeoPhotosProvider>
  );
}
