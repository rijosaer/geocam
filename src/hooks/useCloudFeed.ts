import { useEffect, useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { photosRepo } from '@/db/repositories/photos';
import { listCloudPhotosPage, type CloudPhoto } from '@/services/cloudPhotos';

export interface CloudFeedItem extends CloudPhoto {
  // Archivo local si la foto ya está en este teléfono: se ve sin conexión y no gasta datos
  localUri: string | null;
}

// Feed de la nube (C2): paginación por cursor, búsqueda por nota y caché persistente (C3)
export function useCloudFeed(search: string) {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';

  const query = useInfiniteQuery({
    // El usuario va en la llave: la caché de una cuenta nunca se muestra en otra
    queryKey: ['cloud', userId, { search }],
    queryFn: ({ pageParam }) => listCloudPhotosPage({ cursor: pageParam, search }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData, // al escribir, se conserva la lista anterior
    enabled: userId !== '',
  });

  const { data: localRows } = useLiveQuery(photosRepo.localUrisQuery(userId), [userId]);

  const photos = useMemo<CloudFeedItem[]>(() => {
    const local = new Map(localRows.map((r) => [r.clientId, r.uri]));
    return (query.data?.pages.flatMap((p) => p.items) ?? []).map((item) => ({
      ...item,
      localUri: local.get(item.clientId) ?? null,
    }));
  }, [query.data, localRows]);

  return { ...query, photos };
}

/** Tiempo real: no recarga a mano, solo le avisa a la caché que quedó desactualizada. */
export function useCloudRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('geocam-cloud-photos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['cloud'] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
