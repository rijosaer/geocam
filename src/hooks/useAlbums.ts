import { useCallback } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { albumsRepo } from '@/db/repositories/albums';
import type { Album } from '@/db/schema';

// Tipo que las pantallas pueden usar sin tocar la capa de datos
export type AlbumItem = Album;

function toReadableError(e: unknown, fallback: string): string {
  if (e instanceof Error && /unique/i.test(e.message)) {
    return 'Ya existe un álbum con ese nombre';
  }
  return e instanceof Error ? e.message : fallback;
}

export function useAlbums() {
  const { data: albums, error } = useLiveQuery(albumsRepo.listQuery());

  const addAlbum = useCallback(async (name: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (trimmed === '') return 'El nombre del álbum no puede estar vacío';
    try {
      await albumsRepo.create(trimmed);
      return null;
    } catch (e) {
      return toReadableError(e, 'No se pudo crear el álbum');
    }
  }, []);

  const removeAlbum = useCallback(async (id: number): Promise<string | null> => {
    try {
      await albumsRepo.remove(id);
      return null;
    } catch (e) {
      return toReadableError(e, 'No se pudo eliminar el álbum');
    }
  }, []);

  return { albums, addAlbum, removeAlbum, error };
}
