import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { listCloudPhotos, signedUrl, type CloudPhoto } from '@/services/cloudPhotos';

// Fotos del usuario en Supabase con URL firmada y tiempo real (C4).
// Funciona en cualquier teléfono donde se inicie la misma sesión.
export function useCloudPhotos() {
  const [photos, setPhotos] = useState<CloudPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setPhotos(await listCloudPhotos());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las fotos de la nube');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // La carga inicial ocurre tras el await de la red (el setState no es síncrono);
    // se mantiene junto a la suscripción para que siempre coincidan
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    // Cualquier cambio en la tabla remota recarga la lista; el canal se limpia al desmontar
    const channel = supabase
      .channel('geocam-cloud-photos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, () => {
        void reload();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  // Las URLs firmadas vencen a la hora: se firman por lote cuando cambia la lista
  useEffect(() => {
    let cancelled = false;
    const sign = async () => {
      const entries = await Promise.all(
        photos.map(async (photo) => {
          try {
            return [photo.storagePath, await signedUrl(photo.storagePath)] as const;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      setUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)));
    };
    void sign();
    return () => {
      cancelled = true;
    };
  }, [photos]);

  return { photos, urls, isLoading, error, reload };
}
