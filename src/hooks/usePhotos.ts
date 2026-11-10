import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import { persistPhoto } from '@/services/photoFiles';
import { useAuth } from '@/context/AuthContext';
import { requestSync } from '@/hooks/useSync';
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
    aiDescription: row.aiDescription,
    favorite: row.favorite,
    albumId: row.albumId,
    createdAt: row.createdAt.getTime(),
    remotePath: row.remotePath,
    pendingSync: syncedAt === null || updatedAt === null || syncedAt < updatedAt,
  };
}

// Borrar = marcar (C1): funciona sin conexión y la marca llega a los demás teléfonos.
// La fila y los archivos se eliminan cuando la marca ya está en la nube.
export async function deletePhoto(id: number): Promise<string | null> {
  try {
    await photosRepo.markDeleted(id);
    requestSync();
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
      requestSync(); // la foto nueva queda pendiente: se pide subirla
    },
    [ownerId]
  );

  const removePhoto = useCallback((id: string) => deletePhoto(Number(id)), []);

  // Agitar para borrar todo: también son marcas, así que no exige conexión (C1)
  const clearAll = useCallback(async () => {
    await photosRepo.markAllDeleted(ownerId);
    requestSync();
  }, [ownerId]);

  return { photos, photosWithLocation, addPhoto, removePhoto, clearAll, error };
}
