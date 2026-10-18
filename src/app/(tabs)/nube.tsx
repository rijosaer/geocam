import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCloudPhotos } from '@/hooks/useCloudPhotos';
import type { CloudPhoto } from '@/services/cloudPhotos';

// Fotos del usuario en Supabase (C4): si abres la sesión en otro teléfono, se ven aquí.
// El bucket es privado, así que cada imagen se muestra con una URL firmada.
export default function CloudScreen() {
  const { photos, urls, isLoading, error, reload } = useCloudPhotos();

  if (isLoading && photos.length === 0) {
    return <ActivityIndicator style={styles.centered} />;
  }

  return (
    <View style={styles.screen}>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={photos}
        keyExtractor={(item) => item.clientId}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void reload()} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Aún no hay fotos en la nube. Sube una desde una foto o usa el botón Sincronizar.
          </Text>
        }
        renderItem={({ item }) => <CloudThumb photo={item} url={urls[item.storagePath]} />}
      />
    </View>
  );
}

function CloudThumb({ photo, url }: { photo: CloudPhoto; url: string | undefined }) {
  return (
    <View style={styles.item}>
      {url !== undefined ? (
        <Image source={{ uri: url }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.placeholderText}>☁</Text>
        </View>
      )}
      <View style={styles.itemMeta}>
        <Text style={styles.itemDate}>{new Date(photo.takenAt).toLocaleString('es-CO')}</Text>
        {photo.favorite && <Text style={styles.star}>★</Text>}
        {photo.note !== null && photo.note !== '' && (
          <Text style={styles.note} numberOfLines={2}>
            {photo.note}
          </Text>
        )}
        {photo.latitude !== null && photo.longitude !== null && (
          <Text style={styles.coords}>
            {photo.latitude.toFixed(5)}, {photo.longitude.toFixed(5)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1 },
  list: { padding: 12, gap: 12, flexGrow: 1 },
  empty: { textAlign: 'center', color: '#737373', marginTop: 32, paddingHorizontal: 24 },
  error: { color: '#dc2626', fontSize: 12, paddingHorizontal: 12, paddingTop: 8 },
  item: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#fafafa',
  },
  image: { width: 96, height: 96, borderRadius: 8, backgroundColor: '#e5e5e5' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 24, color: '#a3a3a3' },
  itemMeta: { flex: 1, gap: 4, justifyContent: 'center' },
  itemDate: { fontSize: 12, color: '#525252' },
  star: { color: '#f59e0b', fontSize: 14 },
  note: { fontSize: 13, color: '#171717' },
  coords: { fontFamily: 'monospace', fontSize: 11, color: '#737373' },
});
