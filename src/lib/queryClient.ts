import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import * as Network from 'expo-network';
import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import Storage from 'expo-sqlite/kv-store';

const DAY = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // durante 30 s no se repite una consulta que ya está en caché
      retry: 2,
      // Para persistir, la caché debe vivir al menos tanto como lo guardado (C3)
      gcTime: DAY,
    },
  },
});

// 1. TanStack Query se entera del estado de la red (en React Native no hay evento 'online')
onlineManager.setEventListener((setOnline) => {
  let initialised = false;
  const subscription = Network.addNetworkStateListener((state) => {
    initialised = true;
    setOnline(!!state.isConnected);
  });
  Network.getNetworkStateAsync()
    .then((state) => {
      if (!initialised) setOnline(!!state.isConnected);
    })
    .catch(() => {});
  return () => subscription.remove();
});

// 2. TanStack Query se entera de cuándo la app vuelve a primer plano
export function useAppFocusManager() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
    });
    return () => subscription.remove();
  }, []);
}

// 3. Hook para que la UI muestre si hay conexión
export function useIsOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline()
  );
}

// 4. Caché que sobrevive al cierre (C3): se guarda en SQLite (kv-store de expo-sqlite,
//    compatible con la API de AsyncStorage). Solo el feed de la nube: la sincronización
//    no se persiste porque su "dato" es el efecto de subir y bajar, no algo que mostrar.
export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: createAsyncStoragePersister({ storage: Storage, key: 'geocam-query-cache' }),
  maxAge: DAY,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.queryKey[0] === 'cloud' && query.state.status === 'success',
  },
};
