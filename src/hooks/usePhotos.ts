import { useCallback, useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import type { Photo } from '@/db/schema';
import type { Coords, GeoPhoto } from '@/types/geo';

// Convierte la fila plana de SQLite al tipo GeoPhoto que ya usan las pantallas
function toGeoPhoto(row: Photo): GeoPhoto {
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
    createdAt: row.createdAt.getTime(),
  };
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
    await photosRepo.create({
      uri,
      source,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      accuracy: coords?.accuracy ?? null,
    });
  }, []);

  const removePhoto = useCallback(async (id: string) => {
    await photosRepo.remove(Number(id));
  }, []);

  const clearAll = useCallback(async () => {
    await photosRepo.clearAll();
  }, []);

  return { photos, photosWithLocation, addPhoto, removePhoto, clearAll, error };
}
