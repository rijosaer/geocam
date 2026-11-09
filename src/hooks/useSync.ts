// La sincronización tratada como una consulta de TanStack Query (T6): se dispara al
// iniciar sesión, al recuperar la red y al volver a primer plano, y se reintenta si falla.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useAuth } from '@/context/AuthContext';
import { queryClient, useIsOnline } from '@/lib/queryClient';
import { photosRepo } from '@/db/repositories/photos';
import { syncMetaRepo } from '@/db/repositories/syncMeta';
import { lastResultKey, syncAll, type SyncResult } from '@/services/sync';

export interface LastSync extends SyncResult {
  ok: boolean;
}

/** Pide un ciclo de sincronización. Sin red queda en pausa y se reanuda solo al reconectar. */
export function requestSync() {
  void queryClient.invalidateQueries({ queryKey: ['sync'] });
}

export function useSync() {
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const isOnline = useIsOnline();
  const { data: pending } = useLiveQuery(photosRepo.pendingQuery(userId), [userId]);
  // El último resultado se guarda en SQLite: sigue visible después de cerrar la app (C4)
  const { data: lastRows } = useLiveQuery(syncMetaRepo.byKeyQuery(lastResultKey(userId)), [
    userId,
  ]);

  const sync = useQuery({
    queryKey: ['sync', userId],
    queryFn: () => syncAll(userId),
    enabled: userId !== '',
    staleTime: 0,
    retry: 2,
    refetchOnReconnect: 'always', // volvió la red
    refetchOnWindowFocus: 'always', // la app volvió a primer plano
  });

  const lastSync = useMemo<LastSync | null>(() => {
    const raw = lastRows[0]?.value;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LastSync;
    } catch {
      return null;
    }
  }, [lastRows]);

  return {
    isOnline,
    pendingCount: pending.length,
    isSyncing: sync.fetchStatus === 'fetching',
    lastSync,
    error: sync.error,
    syncNow: () => void sync.refetch(),
  };
}
