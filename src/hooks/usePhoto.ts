import { useCallback, useMemo, useState } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { photosRepo } from '@/db/repositories/photos';
import { deletePhoto, toGeoPhoto } from '@/hooks/usePhotos';
import { useAuth } from '@/context/AuthContext';
import type { GeoPhoto } from '@/types/geo';

// Foto individual para la pantalla de detalle: consulta reactiva por id
export function usePhoto(id: string | undefined) {
  const { session } = useAuth();
  const ownerId = session?.user.id ?? '';
  const numericId = id !== undefined ? Number(id) : NaN;
  const isValid = Number.isInteger(numericId) && numericId > 0;

  const { data: rows, error: queryError, updatedAt } = useLiveQuery(
    photosRepo.byIdQuery(numericId, ownerId),
    [numericId, ownerId]
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const photo = useMemo<GeoPhoto | null>(() => {
    if (!isValid || rows.length === 0) return null;
    return toGeoPhoto(rows[0]);
  }, [rows, isValid]);

  const loading = updatedAt === undefined && queryError === undefined;

  const setNote = useCallback(
    async (note: string) => {
      if (!isValid) return;
      const trimmed = note.trim();
      try {
        await photosRepo.update(numericId, { note: trimmed === '' ? null : trimmed });
        setActionError(null);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'No se pudo guardar la nota');
      }
    },
    [isValid, numericId]
  );

  const toggleFavorite = useCallback(async () => {
    if (!isValid) return;
    try {
      const current = photosRepo.findById(numericId, ownerId);
      await photosRepo.update(numericId, { favorite: !(current?.favorite ?? false) });
      setActionError(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No se pudo actualizar la favorita');
    }
  }, [isValid, numericId, ownerId]);

  const moveToAlbum = useCallback(
    async (albumId: number | null) => {
      if (!isValid) return;
      try {
        await photosRepo.update(numericId, { albumId });
        setActionError(null);
      } catch (e) {
        setActionError(e instanceof Error ? e.message : 'No se pudo mover la foto');
      }
    },
    [isValid, numericId]
  );

  const remove = useCallback(async (): Promise<boolean> => {
    if (!isValid) return false;
    const message = await deletePhoto(numericId, ownerId);
    if (message !== null) {
      setActionError(message);
      return false;
    }
    setActionError(null);
    return true;
  }, [isValid, numericId, ownerId]);

  const error = actionError ?? (queryError ? queryError.message : null);

  return { photo, loading, error, setNote, toggleFavorite, moveToAlbum, remove };
}
