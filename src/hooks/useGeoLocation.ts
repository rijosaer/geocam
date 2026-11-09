import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';
import * as Location from 'expo-location';
import type { Coords, PermissionState } from '@/types/geo';

// Sin señal (modo avión) una lectura puede tardar ~30 s: guardar la foto no debe esperarla
const GPS_TIMEOUT_MS = 4000;
const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;

interface Options {
  watch?: boolean;
}

interface GeoLocationState {
  permission: PermissionState;
  coords: Coords | null;
  error: string | null;
}

function mapPermission(res: Location.LocationPermissionResponse): PermissionState {
  if (res.granted) return 'granted';
  if (!res.canAskAgain) return 'blocked';
  if (res.status === 'undetermined') return 'undetermined';
  return 'denied';
}

function toCoords(loc: Location.LocationObject): Coords {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy,
    timestamp: loc.timestamp,
  };
}

export function useGeoLocation({ watch = false }: Options = {}) {
  const [state, setState] = useState<GeoLocationState>({
    permission: 'checking',
    coords: null,
    error: null,
  });

  // 1. Al montar (y al volver de Ajustes): solo CONSULTAR el permiso, nunca pedirlo
  useEffect(() => {
    let cancelled = false;

    const check = () => {
      Location.getForegroundPermissionsAsync()
        .then((res) => {
          if (!cancelled) setState((s) => ({ ...s, permission: mapPermission(res) }));
        })
        .catch(() => {
          if (!cancelled) setState((s) => ({ ...s, permission: 'denied' }));
        });
    };

    check();
    const appStateSub = AppState.addEventListener('change', (status) => {
      if (status === 'active') check();
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
    };
  }, []);

  // 2. Solicitar permiso por acción explícita del usuario
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const res = await Location.requestForegroundPermissionsAsync();
    setState((s) => ({ ...s, permission: mapPermission(res) }));
    return res.granted;
  }, []);

  // 3. Lectura única, útil justo antes de tomar la foto
  const getCurrent = useCallback(async (): Promise<Coords | null> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const current = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), GPS_TIMEOUT_MS);
        }),
      ]);
      const loc =
        current ??
        (await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }));
      if (!loc) return null; // degradación elegante: la foto se guarda sin coordenadas
      const coords = toCoords(loc);
      setState((s) => ({ ...s, coords, error: null }));
      return coords;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo obtener la ubicación';
      setState((s) => ({ ...s, error: message }));
      return null;
    } finally {
      clearTimeout(timer);
    }
  }, []);

  // 4. Seguimiento continuo con limpieza segura ante desmontaje temprano
  useEffect(() => {
    if (!watch || state.permission !== 'granted') return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
      (loc) => setState((s) => ({ ...s, coords: toCoords(loc), error: null }))
    )
      .then((sub) => {
        if (cancelled) sub.remove(); // se desmontó antes de resolver
        else subscription = sub;
      })
      .catch((e) =>
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : 'Error de GPS' }))
      );

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [watch, state.permission]);

  const openSettings = useCallback(() => Linking.openSettings(), []);

  return { ...state, requestPermission, getCurrent, openSettings };
}
