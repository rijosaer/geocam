import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useCameraPermissions, type CameraView, type PermissionResponse } from 'expo-camera';
import { useCamera } from '@/hooks/useCamera';

jest.mock('expo-camera', () => ({ useCameraPermissions: jest.fn() }));

const usePermissions = jest.mocked(useCameraPermissions);
const request = jest.fn();
const get = jest.fn();

function perm(granted: boolean, canAskAgain: boolean, status: string) {
  return { granted, canAskAgain, status, expires: 'never' } as PermissionResponse;
}

function mockPermission(response: PermissionResponse | null) {
  usePermissions.mockReturnValue([response, request, get]);
}

function attachCamera(
  current: { cameraRef: { current: CameraView | null } },
  takePictureAsync: jest.Mock
) {
  current.cameraRef.current = { takePictureAsync } as unknown as CameraView;
}

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue(perm(true, true, 'granted'));
  mockPermission(perm(true, true, 'granted'));
});

afterEach(() => jest.restoreAllMocks());

test.each([
  ['checking', null],
  ['granted', perm(true, true, 'granted')],
  ['blocked', perm(false, false, 'denied')],
  ['undetermined', perm(false, true, 'undetermined')],
  ['denied', perm(false, true, 'denied')],
])('mapea el permiso a %s', async (expected, response) => {
  mockPermission(response);
  const { result } = await renderHook(() => useCamera());

  expect(result.current.permissionState).toBe(expected);
});

test('no captura antes de onCameraReady', async () => {
  const takePictureAsync = jest.fn();
  const { result } = await renderHook(() => useCamera());
  attachCamera(result.current, takePictureAsync);

  let photo: unknown = 'sin llamar';
  await act(async () => {
    photo = await result.current.takePhoto();
  });

  expect(photo).toBeNull();
  expect(takePictureAsync).not.toHaveBeenCalled();
});

test('un doble toque solo dispara una captura', async () => {
  let resolve: (photo: { uri: string }) => void = () => undefined;
  const takePictureAsync = jest.fn(() => new Promise((r) => (resolve = r)));
  const { result } = await renderHook(() => useCamera());
  attachCamera(result.current, takePictureAsync);
  await act(async () => result.current.onCameraReady());

  let first: Promise<unknown> = Promise.resolve();
  let second: unknown = 'sin llamar';
  await act(async () => {
    first = result.current.takePhoto();
    second = await result.current.takePhoto();
  });
  expect(second).toBeNull();
  expect(takePictureAsync).toHaveBeenCalledTimes(1);

  await act(async () => {
    resolve({ uri: 'file://foto.jpg' });
  });
  await expect(first).resolves.toEqual({ uri: 'file://foto.jpg' });
  expect(result.current.isCapturing).toBe(false);
});

test('un fallo de captura llega a la UI como error', async () => {
  const takePictureAsync = jest.fn().mockRejectedValue(new Error('Cámara ocupada'));
  const { result } = await renderHook(() => useCamera());
  attachCamera(result.current, takePictureAsync);
  await act(async () => result.current.onCameraReady());

  await act(async () => {
    await result.current.takePhoto();
  });

  expect(result.current.error).toBe('Cámara ocupada');
  expect(result.current.isCapturing).toBe(false);
});

test('toggleFacing alterna entre trasera y frontal', async () => {
  const { result } = await renderHook(() => useCamera());
  expect(result.current.facing).toBe('back');

  await act(async () => result.current.toggleFacing());
  expect(result.current.facing).toBe('front');
});

test('al volver de Ajustes vuelve a consultar el permiso', async () => {
  let onChange: (status: AppStateStatus) => void = () => undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
    onChange = handler;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
  await renderHook(() => useCamera());

  await act(async () => onChange('active'));

  expect(get).toHaveBeenCalledTimes(1);
});
