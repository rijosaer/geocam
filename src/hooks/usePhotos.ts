import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import { deletePhotoFile, persistPhoto } from '@/services/photoFiles';
import { deletePhotoCoherent } from '@/services/cloudPhotos';
import { useAuth } from '@/context/AuthContext';
import type { Photo } from '@/db/schema';
import type { Coords, GeoPhoto } from '@/types/geo';

// Convierte la fila plana de SQLite al tipo GeoPhoto que ya usan las pantallas
export function toGeoPhoto(row: Photo): GeoPhoto {
  const syncedAt = row.syncedAt?.getTime() ?? null;
  const updatedAt = row.updatedAt?.getTime() ?? null;
  return {
    id: String(row.id),
    uri: row.uri,
    coords:
      row.latitude !== null && row.longitude !== null
        ? {
            latitude: row.latitude,
            longitude: row.longitude,
            accuracy: row.accuracy,
            timestamp: row.createdAt.getTime(),
          }
        : null,
    source: row.source,
    note: row.note,
    favorite: row.favorite,
    albumId: row.albumId,
    createdAt: row.createdAt.getTime(),
    remotePath: row.remotePath,
    pendingSync: syncedAt === null || updatedAt === null || syncedAt < updatedAt,
  };
}

// Borra la foto con coherencia entre la nube y el teléfono (C3).
// Devuelve el mensaje de error, o null si todo salió bien.
export async function deletePhoto(id: number, ownerId: string): Promise<string | null> {
  const photo = photosRepo.findById(id, ownerId);
  if (!photo) return null;
  try {
    await deletePhotoCoherent(photo);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'No se pudo eliminar la foto';
  }
}

export interface AddPhotoInput {
  uri: string;
  source: GeoPhoto['source'];
  coords: Coords | null;
}

export function usePhotos() {
  const { session } = useAuth();
  const ownerId = session?.user.id ?? '';

  const { data: photoRows, error } = useLiveQuery(photosRepo.listQuery(ownerId), [ownerId]);
  const { data: locatedRows } = useLiveQuery(photosRepo.withLocationQuery(ownerId), [ownerId]);

  const photos = useMemo(() => photoRows.map(toGeoPhoto), [photoRows]);
  const photosWithLocation = useMemo(() => locatedRows.map(toGeoPhoto), [locatedRows]);

  const addPhoto = useCallback(
    async ({ uri, source, coords }: AddPhotoInput) => {
      const permanentUri = await persistPhoto(uri);
      await photosRepo.create({
        uri: permanentUri,
        source,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        accuracy: coords?.accuracy ?? null,
        ownerId,
      });
    },
    [ownerId]
  );

  const removePhoto = useCallback(
    (id: string) => deletePhoto(Number(id), ownerId),
    [ownerId]
  );

  // Borrar todo también exige la nube: sin conexión no se borra nada a medias (C3)
  const clearAll = useCallback(async () => {
    const rows = await photosRepo.listAll(ownerId);
    const synced = rows.filter((row) => row.remotePath !== null);
    for (const row of synced) {
      await deletePhotoCoherent(row);
    }
    const rest = rows.filter((row) => row.remotePath === null);
    for (const row of rest) {
      await photosRepo.remove(row.id);
      deletePhotoFile(row.uri);
    }
  }, [ownerId]);

  return { photos, photosWithLocation, addPhoto, removePhoto, clearAll, error };
}
