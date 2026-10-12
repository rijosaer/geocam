import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAlbums } from '@/hooks/useAlbums';
import { usePhoto } from '@/hooks/usePhoto';
import { SOURCE_COLOR, SOURCE_LABEL } from '@/constants/colors';

interface NoteEditorProps {
  initial: string;
  onSave: (note: string) => void;
}

// Se monta solo cuando la foto ya está cargada, así el borrador parte del valor real
function NoteEditor({ initial, onSave }: NoteEditorProps) {
  const [draft, setDraft] = useState(initial);

  return (
    <>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Escribe una nota"
        placeholderTextColor="#9ca3af"
        multiline
        style={styles.noteInput}
      />
      <Pressable onPress={() => onSave(draft)} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Guardar nota</Text>
      </Pressable>
    </>
  );
}

export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { photo, loading, error, setNote, toggleFavorite, moveToAlbum, remove } = usePhoto(id);
  const { albums } = useAlbums();

  if (loading) {
    return <ActivityIndicator style={styles.centered} />;
  }

  if (!photo) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFound}>Foto no encontrada</Text>
        {error !== null && <Text style={styles.errorText}>{error}</Text>}
      </View>
    );
  }

  const confirmDelete = () => {
    Alert.alert('Eliminar foto', '¿Eliminar esta foto? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const ok = await remove();
          if (ok) router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Image source={{ uri: photo.uri }} style={styles.image} />

      <View style={styles.meta}>
        <Text style={[styles.source, { color: SOURCE_COLOR[photo.source] }]}>
          {SOURCE_LABEL[photo.source]}
        </Text>
        <Text style={styles.metaText}>{new Date(photo.createdAt).toLocaleString()}</Text>
        {photo.coords ? (
          <Text style={styles.metaText}>
            {photo.coords.latitude.toFixed(5)}, {photo.coords.longitude.toFixed(5)}
            {photo.coords.accuracy !== null ? `  ±${Math.round(photo.coords.accuracy)} m` : ''}
          </Text>
        ) : (
          <Text style={styles.metaText}>Sin coordenadas</Text>
        )}
      </View>

      {error !== null && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nota</Text>
        <NoteEditor key={photo.id} initial={photo.note ?? ''} onSave={setNote} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Favorita</Text>
        <Pressable
          onPress={toggleFavorite}
          style={[styles.favoriteButton, photo.favorite && styles.favoriteButtonActive]}
        >
          <Text
            style={[styles.favoriteButtonText, photo.favorite && styles.favoriteButtonTextActive]}
          >
            {photo.favorite ? '★ Quitar de favoritas' : '☆ Marcar como favorita'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Álbum</Text>
        <View style={styles.chipRow}>
          <Pressable
            onPress={() => moveToAlbum(null)}
            style={[styles.chip, photo.albumId === null && styles.chipActive]}
          >
            <Text style={[styles.chipText, photo.albumId === null && styles.chipTextActive]}>
              Sin álbum
            </Text>
          </Pressable>
          {albums.map((album) => {
            const active = photo.albumId === album.id;
            return (
              <Pressable
                key={album.id}
                onPress={() => moveToAlbum(album.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{album.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable onPress={confirmDelete} style={styles.deleteButton}>
        <Text style={styles.deleteButtonText}>Eliminar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { paddingBottom: 32 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  notFound: { fontSize: 16, color: '#525252' },
  image: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#f5f5f5' },
  meta: { padding: 16, gap: 4 },
  source: { fontWeight: '700' },
  metaText: { fontSize: 13, color: '#404040' },
  errorText: { paddingHorizontal: 16, color: '#dc2626', fontSize: 12 },
  section: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  sectionTitle: { fontWeight: '700', color: '#171717' },
  noteInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#171717',
    textAlignVertical: 'top',
  },
  primaryButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: '#171717',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  favoriteButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 10,
    paddingVertical: 10,
  },
  favoriteButtonActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  favoriteButtonText: { color: '#525252', fontWeight: '600' },
  favoriteButtonTextActive: { color: '#fff' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  deleteButton: {
    marginHorizontal: 16,
    marginTop: 16,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#dc2626',
    paddingVertical: 12,
  },
  deleteButtonText: { color: '#fff', fontWeight: '700' },
});
