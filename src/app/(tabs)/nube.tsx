import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCloudFeed, useCloudRealtime, type CloudFeedItem } from '@/hooks/useCloudFeed';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useIsOnline } from '@/lib/queryClient';

// Feed de la nube (C2): lo que hay en Supabase con esta cuenta, de 10 en 10.
// Con la caché persistente (C3) se ve lo último cargado aunque se abra sin conexión.
export default function CloudScreen() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const isOnline = useIsOnline();
  const feed = useCloudFeed(debouncedSearch);
  useCloudRealtime();
  // Un refresco fallido no borra lo que ya se tenía: la lista se muestra si hay datos
  const hasData = feed.data !== undefined;

  return (
    <View style={styles.screen}>
      {/* Estado: sin conexión (con o sin datos guardados) */}
      {!isOnline && (
        <Text style={styles.offline}>
          Sin conexión. {feed.photos.length > 0 ? 'Se muestran los datos guardados.' : ''}
        </Text>
      )}

      <TextInput
        style={styles.search}
        placeholder="Buscar en la nube por nota"
        placeholderTextColor="#9ca3af"
        value={search}
        onChangeText={setSearch}
        returnKeyType="search"
      />

      {/* Estado: primera carga */}
      {feed.status === 'pending' && feed.fetchStatus === 'fetching' && (
        <ActivityIndicator style={styles.loading} />
      )}

      {/* Estado: sin datos y sin red (nunca se pudo cargar) */}
      {feed.status === 'pending' && feed.fetchStatus === 'paused' && (
        <Text style={styles.empty}>Conéctate a internet para cargar tus fotos de la nube.</Text>
      )}

      {/* Estado: error, con opción de reintentar */}
      {feed.status === 'error' && !hasData && (
        <View style={styles.center}>
          <Text style={styles.error}>{feed.error.message}</Text>
          <Pressable onPress={() => void feed.refetch()} style={styles.retry}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      )}

      {/* Con red, pero el último refresco falló: se avisa sin quitar la lista */}
      {feed.status === 'error' && hasData && isOnline && (
        <Pressable onPress={() => void feed.refetch()}>
          <Text style={styles.stale}>No se pudo actualizar. Toca para reintentar.</Text>
        </Pressable>
      )}

      {hasData && (
        <FlatList
          data={feed.photos}
          keyExtractor={(item) => item.clientId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <CloudThumb photo={item} />}
          // Estado: vacío (distinto según haya búsqueda o no)
          ListEmptyComponent={
            <Text style={styles.empty}>
              {debouncedSearch
                ? 'Ninguna foto de la nube coincide con la búsqueda.'
                : 'Aún no hay fotos en la nube. Se suben solas al tomarlas con conexión.'}
            </Text>
          }
          // Deslizar hacia abajo para refrescar
          refreshing={feed.isRefetching && !feed.isFetchingNextPage}
          onRefresh={() => void feed.refetch()}
          // Infinite scroll
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
          }}
          ListFooterComponent={
            feed.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
        />
      )}
    </View>
  );
}

function CloudThumb({ photo }: { photo: CloudFeedItem }) {
  const uri = photo.localUri ?? photo.imageUrl;
  return (
    <View style={styles.item}>
      {uri !== null ? (
        <Image source={{ uri }} style={styles.image} />
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
  offline: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stale: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  search: {
    margin: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#171717',
  },
  loading: { marginTop: 40 },
  center: { alignItems: 'center', gap: 12, padding: 24 },
  retry: { backgroundColor: '#171717', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '600' },
  list: { padding: 12, gap: 12, flexGrow: 1 },
  footer: { margin: 16 },
  empty: { textAlign: 'center', color: '#737373', marginTop: 32, paddingHorizontal: 24 },
  error: { color: '#dc2626', fontSize: 13, textAlign: 'center' },
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
