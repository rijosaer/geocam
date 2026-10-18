import { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useAlbums, type AlbumItem } from '@/hooks/useAlbums';
import { usePhotoFilters } from '@/hooks/usePhotoFilters';
import { useSync } from '@/hooks/useSync';
import { useAuth } from '@/context/AuthContext';
import { SOURCE_COLOR } from '@/constants/colors';

const GAP = 8;
const PADDING = 12;

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

function Chip({ label, active, onPress, onLongPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function PhotosScreen() {
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [albumId, setAlbumId] = useState<number | null>(null);
  const [newAlbum, setNewAlbum] = useState('');
  const [albumError, setAlbumError] = useState<string | null>(null);

  const { albums, addAlbum, removeAlbum } = useAlbums();
  const { photos, error } = usePhotoFilters({ search, albumId, onlyFavorites });
  const { session, signOut } = useAuth();
  const { isSyncing, progress, summary, sync } = useSync();

  const thumbSize = (width - PADDING * 2 - GAP * 2) / 3;

  const handleCreateAlbum = async () => {
    const message = await addAlbum(newAlbum);
    if (message) {
      setAlbumError(message);
      return;
    }
    setNewAlbum('');
    setAlbumError(null);
  };

  const confirmRemoveAlbum = (album: AlbumItem) => {
    Alert.alert('Eliminar álbum', `¿Eliminar "${album.name}"? Las fotos quedarán sin álbum.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const message = await removeAlbum(album.id);
          if (message) setAlbumError(message);
          if (albumId === album.id) setAlbumId(null);
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.sessionBar}>
        <Text style={styles.sessionEmail} numberOfLines={1}>
          {session?.user.email}
        </Text>
        <Pressable onPress={() => void signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </Pressable>
      </View>

      <View style={styles.syncRow}>
        <Pressable
          onPress={() => void sync()}
          disabled={isSyncing}
          style={[styles.syncButton, isSyncing && styles.syncButtonBusy]}
        >
          <Text style={styles.syncButtonText}>
            {isSyncing && progress !== null && progress.total > 0
              ? `Subiendo ${progress.done} de ${progress.total}…`
              : '☁ Sincronizar'}
          </Text>
        </Pressable>
        <Text style={styles.syncHint}>Sube las fotos pendientes a tu nube privada</Text>
      </View>
      {summary !== null && <Text style={styles.syncSummary}>{summary}</Text>}

      <View style={styles.controls}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nota"
          placeholderTextColor="#9ca3af"
          style={styles.search}
          returnKeyType="search"
        />

        <Pressable
          onPress={() => setOnlyFavorites((value) => !value)}
          style={[styles.favoriteChip, onlyFavorites && styles.favoriteChipActive]}
        >
          <Text style={[styles.favoriteText, onlyFavorites && styles.favoriteTextActive]}>
            {onlyFavorites ? '★ Solo favoritas' : '☆ Solo favoritas'}
          </Text>
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip label="Todos" active={albumId === null} onPress={() => setAlbumId(null)} />
          {albums.map((album) => (
            <Chip
              key={album.id}
              label={album.name}
              active={albumId === album.id}
              onPress={() => setAlbumId(album.id)}
              onLongPress={() => confirmRemoveAlbum(album)}
            />
          ))}
        </ScrollView>

        <View style={styles.createRow}>
          <TextInput
            value={newAlbum}
            onChangeText={setNewAlbum}
            placeholder="Nuevo álbum"
            placeholderTextColor="#9ca3af"
            style={styles.albumInput}
            returnKeyType="done"
            onSubmitEditing={handleCreateAlbum}
          />
          <Pressable onPress={handleCreateAlbum} style={styles.createButton}>
            <Text style={styles.createButtonText}>Crear</Text>
          </Pressable>
        </View>

        {albumError !== null && <Text style={styles.errorText}>{albumError}</Text>}
        {error !== undefined && <Text style={styles.errorText}>{error.message}</Text>}
      </View>

      <FlatList
        data={photos}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/foto/[id]', params: { id: item.id } })}
            style={[styles.thumbWrap, { width: thumbSize, height: thumbSize }]}
          >
            <Image
              source={{ uri: item.uri }}
              style={[styles.thumb, { borderColor: SOURCE_COLOR[item.source] }]}
            />
            {item.favorite && <Text style={styles.star}>★</Text>}
            {item.remotePath !== null && <Text style={styles.cloudIcon}>☁</Text>}
            {item.note !== null && item.note !== '' && (
              <Text style={styles.note} numberOfLines={1}>
                {item.note}
              </Text>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No hay fotos que coincidan con los filtros.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  sessionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PADDING,
    paddingTop: PADDING,
    gap: 12,
  },
  sessionEmail: { flex: 1, fontSize: 13, color: '#525252' },
  signOutButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d4d4d4',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  signOutText: { fontSize: 12, fontWeight: '600', color: '#525252' },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: PADDING,
    paddingTop: 8,
  },
  syncButton: {
    borderRadius: 10,
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  syncButtonBusy: { opacity: 0.6 },
  syncButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  syncHint: { flex: 1, fontSize: 12, color: '#737373' },
  syncSummary: {
    paddingHorizontal: PADDING,
    paddingTop: 4,
    fontSize: 12,
    color: '#047857',
  },
  controls: { padding: PADDING, gap: 10, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' },
  search: {
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#171717',
  },
  favoriteChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  favoriteChipActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  favoriteText: { color: '#525252', fontWeight: '600', fontSize: 13 },
  favoriteTextActive: { color: '#fff' },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  chipText: { color: '#525252', fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  createRow: { flexDirection: 'row', gap: 8 },
  albumInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#171717',
  },
  createButton: {
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#171717',
    paddingHorizontal: 16,
  },
  createButtonText: { color: '#fff', fontWeight: '700' },
  errorText: { color: '#dc2626', fontSize: 12 },
  list: { padding: PADDING, gap: GAP, flexGrow: 1 },
  column: { gap: GAP },
  thumbWrap: { borderRadius: 8, overflow: 'hidden' },
  thumb: { flex: 1, borderWidth: 2 },
  star: { position: 'absolute', top: 4, right: 6, fontSize: 16, color: '#f59e0b' },
  cloudIcon: {
    position: 'absolute',
    bottom: 20,
    right: 6,
    fontSize: 12,
    color: '#10b981',
  },
  note: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    color: '#fff',
    fontSize: 10,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  empty: { textAlign: 'center', color: '#737373', marginTop: 32, paddingHorizontal: 24 },
});
