import { Alert, View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useIsFocused } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCamera } from '@/hooks/useCamera';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { usePhotos } from '@/hooks/usePhotos';
import { PermissionPrimer } from '@/components/PermissionPrimer';
import { ShakeToClear } from '@/components/ShakeToClear';
import { SOURCE_COLOR, SOURCE_LABEL } from '@/constants/colors';
import type { Coords, GeoPhoto } from '@/types/geo';

export default function GeoCamScreen() {
  // En Tabs la pantalla no se desmonta al cambiar de pestaña:
  // el GPS, la cámara y el acelerómetro solo corren con la pestaña visible
  const isFocused = useIsFocused();
  const { top } = useSafeAreaInsets();
  // Desestructurado: cameraRef es un ref y el React Compiler no permite leer
  // en el render un objeto que lo contenga
  const {
    cameraRef,
    permissionState,
    requestPermission,
    openSettings,
    facing,
    toggleFacing,
    onCameraReady,
    takePhoto,
    isCapturing,
    error: cameraError,
  } = useCamera();
  const geo = useGeoLocation({ watch: isFocused });
  const { photos, addPhoto } = usePhotos();
  const lastPhoto = photos[0] ?? null;

  if (permissionState === 'checking') {
    return <View style={styles.dark} />;
  }

  if (permissionState !== 'granted') {
    return (
      <PermissionPrimer
        title="GeoCam necesita tu cámara"
        description="La usamos solo para tomar fotos que tú decidas guardar."
        state={permissionState}
        onRequest={requestPermission}
        onOpenSettings={openSettings}
      />
    );
  }

  // Degradación elegante: sin permiso de ubicación, coords queda en null
  const currentCoords = async (): Promise<Coords | null> =>
    geo.permission === 'granted' ? geo.coords ?? (await geo.getCurrent()) : null;

  const savePhoto = async (uri: string, source: GeoPhoto['source']) => {
    const coords = await currentCoords();
    await addPhoto({ uri, coords, source });
  };

  const handleCapture = async () => {
    // Pedir en contexto: la primera foto es el momento de pedir la ubicación
    if (geo.permission === 'undetermined') await geo.requestPermission();
    const photo = await takePhoto();
    if (photo) await savePhoto(photo.uri, 'camera');
  };

  const handleImport = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (!result.canceled) await savePhoto(result.assets[0].uri, 'gallery');
    } catch (e) {
      Alert.alert('No se pudo importar', e instanceof Error ? e.message : 'Intenta de nuevo');
    }
  };

  const error = cameraError ?? geo.error;

  return (
    <View style={styles.screen}>
      {isFocused && <ShakeToClear />}

      {/* CameraView sin hijos: los controles van como hermanos absolutos */}
      {isFocused && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          onCameraReady={onCameraReady}
        />
      )}

      {/* Banner de ubicación: pedir en contexto sin bloquear la cámara */}
      {geo.permission !== 'granted' && geo.permission !== 'checking' && (
        <Pressable
          onPress={geo.permission === 'blocked' ? geo.openSettings : geo.requestPermission}
          style={[styles.banner, { top: top + 12 }]}
        >
          <Text style={styles.bannerText}>
            {geo.permission === 'blocked'
              ? 'Ubicación desactivada: toca para abrir Ajustes. Tus fotos se guardan sin coordenadas.'
              : 'Toca aquí para permitir la ubicación y etiquetar tus fotos'}
          </Text>
        </Pressable>
      )}

      {/* Coordenadas en vivo */}
      {geo.permission === 'granted' && geo.coords && (
        <View style={[styles.coords, { top: top + 12 }]}>
          <Text style={styles.coordsText}>
            {geo.coords.latitude.toFixed(5)}, {geo.coords.longitude.toFixed(5)}
          </Text>
          <Text style={styles.accuracyText}>±{Math.round(geo.coords.accuracy ?? 0)} m</Text>
        </View>
      )}

      {error && (
        <View style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Controles inferiores */}
      <View style={styles.controls}>
        {lastPhoto ? (
          <View style={styles.thumbWrap}>
            <Image
              source={{ uri: lastPhoto.uri }}
              style={[styles.thumb, { borderColor: SOURCE_COLOR[lastPhoto.source] }]}
            />
            <Text style={[styles.thumbLabel, { color: SOURCE_COLOR[lastPhoto.source] }]}>
              {SOURCE_LABEL[lastPhoto.source]}
            </Text>
          </View>
        ) : (
          <View style={styles.thumbWrap} />
        )}

        <Pressable
          onPress={handleCapture}
          disabled={isCapturing}
          style={({ pressed }) => [styles.shutter, pressed && styles.pressed]}
          accessibilityLabel="Tomar foto"
        >
          <View style={[styles.shutterInner, isCapturing && styles.shutterBusy]} />
        </Pressable>

        <View style={styles.sideButtons}>
          <Pressable onPress={handleImport} style={styles.iconButton} accessibilityLabel="Importar de galería">
            <Text style={styles.iconText}>🖼</Text>
          </Pressable>
          <Pressable onPress={toggleFacing} style={styles.iconButton} accessibilityLabel="Cambiar cámara">
            <Text style={styles.iconText}>↻</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: '#0a0a0a' },
  screen: { flex: 1, backgroundColor: '#000' },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.9)',
    padding: 12,
  },
  bannerText: { textAlign: 'center', fontWeight: '500', color: '#171717' },
  coords: {
    position: 'absolute',
    left: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  coordsText: { fontFamily: 'monospace', fontSize: 12, color: '#6ee7b7' },
  accuracyText: { fontFamily: 'monospace', fontSize: 12, color: '#a3a3a3' },
  error: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 140,
    borderRadius: 8,
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
    padding: 8,
  },
  errorText: { textAlign: 'center', color: '#fff', fontSize: 12 },
  controls: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  thumbWrap: { width: 56, alignItems: 'center', gap: 4 },
  thumb: { width: 56, height: 56, borderRadius: 8, borderWidth: 2 },
  thumbLabel: { fontSize: 10, fontWeight: '700' },
  shutter: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
  },
  pressed: { opacity: 0.7 },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
  shutterBusy: { backgroundColor: '#a3a3a3' },
  sideButtons: { width: 56, alignItems: 'center', gap: 12 },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  iconText: { fontSize: 24, color: '#fff' },
});
