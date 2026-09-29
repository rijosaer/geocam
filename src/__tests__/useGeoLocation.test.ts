import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { useGeoLocation } from '@/hooks/useGeoLocation';

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const loc = jest.mocked(Location);
const remove = jest.fn();
const subscription = { remove } as unknown as Location.LocationSubscription;

function perm(granted: boolean, canAskAgain: boolean, status: string) {
  return { granted, canAskAgain, status, expires: 'never' } as Location.LocationPermissionResponse;
}

const GRANTED = perm(true, true, 'granted');
const position = {
  coords: { latitude: 4.711, longitude: -74.072, accuracy: 12 },
  timestamp: 1000,
} as Location.LocationObject;

const flush = () => act(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  loc.getForegroundPermissionsAsync.mockResolvedValue(perm(false, true, 'undetermined'));
  loc.watchPositionAsync.mockResolvedValue(subscription);
});

afterEach(() => jest.restoreAllMocks());

test.each([
  ['granted', perm(true, true, 'granted')],
  ['blocked', perm(false, false, 'denied')],
  ['undetermined', perm(false, true, 'undetermined')],
  ['denied', perm(false, true, 'denied')],
])('mapea el permiso a %s', async (expected, response) => {
  loc.getForegroundPermissionsAsync.mockResolvedValue(response);
  const { result } = await renderHook(() => useGeoLocation());
  await flush();

  expect(result.current.permission).toBe(expected);
});

test('al montar solo consulta el permiso, nunca lo pide', async () => {
  const { result } = await renderHook(() => useGeoLocation());
  await flush();

  expect(loc.getForegroundPermissionsAsync).toHaveBeenCalled();
  expect(loc.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(result.current.permission).toBe('undetermined');
});

test('requestPermission pide el permiso y actualiza el estado', async () => {
  loc.requestForegroundPermissionsAsync.mockResolvedValue(GRANTED);
  const { result } = await renderHook(() => useGeoLocation());
  await flush();

  let granted = false;
  await act(async () => {
    granted = await result.current.requestPermission();
  });

  expect(granted).toBe(true);
  expect(result.current.permission).toBe('granted');
});

test('sin watch no enciende el GPS', async () => {
  loc.getForegroundPermissionsAsync.mockResolvedValue(GRANTED);
  await renderHook(() => useGeoLocation());
  await flush();

  expect(loc.watchPositionAsync).not.toHaveBeenCalled();
});

test('sin permiso no enciende el GPS aunque watch sea true', async () => {
  await renderHook(() => useGeoLocation({ watch: true }));
  await flush();

  expect(loc.watchPositionAsync).not.toHaveBeenCalled();
});

test('con permiso sigue la ubicación y limpia al desmontar', async () => {
  loc.getForegroundPermissionsAsync.mockResolvedValue(GRANTED);
  const { result, unmount } = await renderHook(() => useGeoLocation({ watch: true }));
  await flush();

  expect(loc.watchPositionAsync).toHaveBeenCalledTimes(1);
  const onUpdate = loc.watchPositionAsync.mock.calls[0][1];
  await act(async () => {
    onUpdate(position);
  });
  expect(result.current.coords).toEqual({
    latitude: 4.711,
    longitude: -74.072,
    accuracy: 12,
    timestamp: 1000,
  });

  await unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});

test('al salir de la pestaña (watch → false) se apaga el GPS', async () => {
  loc.getForegroundPermissionsAsync.mockResolvedValue(GRANTED);
  const { rerender } = await renderHook(({ watch }: { watch: boolean }) => useGeoLocation({ watch }), {
    initialProps: { watch: true },
  });
  await flush();
  await rerender({ watch: false });

  expect(remove).toHaveBeenCalledTimes(1);
});

test('desmontar antes de que resuelva watchPositionAsync elimina la suscripción huérfana', async () => {
  loc.getForegroundPermissionsAsync.mockResolvedValue(GRANTED);
  let resolve: (sub: Location.LocationSubscription) => void = () => undefined;
  loc.watchPositionAsync.mockReturnValue(new Promise((r) => (resolve = r)));

  const { unmount } = await renderHook(() => useGeoLocation({ watch: true }));
  await flush();
  await unmount();
  expect(remove).not.toHaveBeenCalled();

  resolve(subscription);
  await flush();
  expect(remove).toHaveBeenCalledTimes(1);
});

test('getCurrent devuelve coordenadas', async () => {
  loc.getCurrentPositionAsync.mockResolvedValue(position);
  const { result } = await renderHook(() => useGeoLocation());
  await flush();

  let coords = null;
  await act(async () => {
    coords = await result.current.getCurrent();
  });

  expect(coords).toMatchObject({ latitude: 4.711, longitude: -74.072 });
  expect(result.current.error).toBeNull();
});

test('getCurrent expone el error como estado', async () => {
  loc.getCurrentPositionAsync.mockRejectedValue(new Error('GPS apagado'));
  const { result } = await renderHook(() => useGeoLocation());
  await flush();

  let coords: unknown = 'sin llamar';
  await act(async () => {
    coords = await result.current.getCurrent();
  });

  expect(coords).toBeNull();
  expect(result.current.error).toBe('GPS apagado');
});

test('al volver de Ajustes vuelve a consultar el permiso', async () => {
  let onChange: (status: AppStateStatus) => void = () => undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
    onChange = handler;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
  loc.getForegroundPermissionsAsync.mockResolvedValue(perm(false, false, 'denied'));

  const { result } = await renderHook(() => useGeoLocation());
  await flush();
  expect(result.current.permission).toBe('blocked');

  loc.getForegroundPermissionsAsync.mockResolvedValue(GRANTED);
  await act(async () => {
    onChange('active');
  });

  expect(result.current.permission).toBe('granted');
});
