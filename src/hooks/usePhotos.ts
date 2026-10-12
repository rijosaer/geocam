import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import { deletePhotoFile, persistPhoto } from '@/services/photoFiles';
import type { Photo } from '@/db/schema';
import type { Coords, GeoPhoto } from '@/types/geo';

// Convierte la fila plana de SQLite al tipo GeoPhoto que ya usan las pantallas
export function toGeoPhoto(row: Photo): GeoPhoto {
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
  };
}

// Borra el registro y después su archivo; la comparten usePhotos y usePhoto
export async function deletePhoto(id: number) {
  const photo = photosRepo.findById(id);
  await photosRepo.remove(id);
  if (photo) deletePhotoFile(photo.uri);
}

export interface AddPhotoInput {
  uri: string;
  source: GeoPhoto['source'];
  coords: Coords | null;
}

export function usePhotos() {
  const { data: photoRows, error } = useLiveQuery(photosRepo.listQuery());
  const { data: locatedRows } = useLiveQuery(photosRepo.withLocationQuery());

  const photos = useMemo(() => photoRows.map(toGeoPhoto), [photoRows]);
  const photosWithLocation = useMemo(() => locatedRows.map(toGeoPhoto), [locatedRows]);

  const addPhoto = useCallback(async ({ uri, source, coords }: AddPhotoInput) => {
    const permanentUri = await persistPhoto(uri);
    await photosRepo.create({
      uri: permanentUri,
      source,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      accuracy: coords?.accuracy ?? null,
    });
  }, []);

  const removePhoto = useCallback((id: string) => deletePhoto(Number(id)), []);

  const clearAll = useCallback(async () => {
    const rows = await photosRepo.listUris();
    await photosRepo.clearAll();
    rows.forEach(({ uri }) => deletePhotoFile(uri));
  }, []);

  return { photos, photosWithLocation, addPhoto, removePhoto, clearAll, error };
}
