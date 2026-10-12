import { useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import { toGeoPhoto } from '@/hooks/usePhotos';
import type { GeoPhoto } from '@/types/geo';

export interface PhotoFilterValues {
  search: string;
  albumId: number | null;
  onlyFavorites: boolean;
}

// La consulta se recalcula cuando cambia cualquiera de los tres filtros
export function usePhotoFilters({ search, albumId, onlyFavorites }: PhotoFilterValues) {
  const { data: rows, error } = useLiveQuery(
    photosRepo.filteredQuery({ search, albumId, onlyFavorites }),
    [search, albumId, onlyFavorites]
  );

  const photos = useMemo<GeoPhoto[]>(() => rows.map(toGeoPhoto), [rows]);

  return { photos, error };
}
