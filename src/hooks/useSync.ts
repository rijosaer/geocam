import { useCallback, useState } from 'react';
import { syncPendingPhotos, type SyncProgress } from '@/services/cloudPhotos';
import { useAuth } from '@/context/AuthContext';

// Botón "Sincronizar": sube los pendientes mostrando avance (C1)
export function useSync() {
  const { session } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const sync = useCallback(async () => {
    if (!session || isSyncing) return;
    setIsSyncing(true);
    setSummary(null);
    setProgress({ done: 0, total: 0 });
    try {
      const result = await syncPendingPhotos(session.user.id, setProgress);
      if (result.total === 0) {
        setSummary('No hay fotos pendientes de subir.');
      } else if (result.failed === 0) {
        setSummary(`Subidas ${result.ok} de ${result.total}.`);
      } else {
        setSummary(
          `Subidas ${result.ok} de ${result.total}; ${result.pendingLeft} quedaron pendientes.`
        );
      }
    } catch (e) {
      setSummary(e instanceof Error ? e.message : 'No se pudo sincronizar con la nube.');
    } finally {
      setIsSyncing(false);
      setProgress(null);
    }
  }, [session, isSyncing]);

  return { isSyncing, progress, summary, sync };
}
