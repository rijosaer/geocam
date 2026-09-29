import { View, Text, Image, Pressable, FlatList, Linking, StyleSheet } from 'react-native';
import { useGeoPhotos } from '@/context/GeoPhotosContext';
import { SOURCE_COLOR, SOURCE_LABEL } from '@/constants/colors';
import type { GeoPhoto } from '@/types/geo';

// react-native-maps no funciona en web: en el navegador las fotos se listan
// y cada una con coordenadas abre su ubicación en Google Maps
export default function MapaWebScreen() {
  const { photos, removePhoto } = useGeoPhotos();

  const renderItem = ({ item }: { item: GeoPhoto }) => (
    <View style={styles.row}>
      <Image source={{ uri: item.uri }} style={[styles.thumb, { borderColor: SOURCE_COLOR[item.source] }]} />
      <View style={styles.info}>
        <Text style={[styles.source, { color: SOURCE_COLOR[item.source] }]}>{SOURCE_LABEL[item.source]}</Text>
        {item.coords ? (
          <Pressable
            onPress={() =>
              Linking.openURL(
                `https://www.google.com/maps?q=${item.coords?.latitude},${item.coords?.longitude}`
              )
            }
          >
            <Text style={styles.link}>
              {item.coords.latitude.toFixed(5)}, {item.coords.longitude.toFixed(5)} · Ver en mapa
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.muted}>Sin ubicación</Text>
        )}
      </View>
      <Pressable onPress={() => removePhoto(item.id)}>
        <Text style={styles.remove}>Eliminar</Text>
      </Pressable>
    </View>
  );

  return (
    <FlatList
      style={styles.screen}
      data={photos}
      keyExtractor={(p) => p.id}
      renderItem={renderItem}
      ListEmptyComponent={
        <Text style={styles.empty}>Aún no hay fotos. Toma una en la pestaña GeoCam.</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  thumb: { width: 64, height: 64, borderRadius: 8, borderWidth: 2 },
  info: { flex: 1, gap: 4 },
  source: { fontWeight: '700' },
  link: { color: '#2563eb' },
  muted: { color: '#737373' },
  remove: { color: '#dc2626', fontWeight: '600' },
  empty: { padding: 24, textAlign: 'center', color: '#404040' },
});
