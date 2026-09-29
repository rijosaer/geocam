import { act, renderHook } from '@testing-library/react-native';
import { Accelerometer } from 'expo-sensors';
import { useShake } from '@/hooks/useShake';

jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: jest.fn(),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(),
  },
}));

type Reading = { x: number; y: number; z: number };

const accel = jest.mocked(Accelerometer);
const remove = jest.fn();
let emit: (reading: Reading) => void = () => undefined;

const flush = () => act(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  accel.isAvailableAsync.mockResolvedValue(true);
  accel.addListener.mockImplementation((listener) => {
    emit = listener as unknown as (reading: Reading) => void;
    return { remove } as unknown as ReturnType<typeof Accelerometer.addListener>;
  });
});

afterEach(() => jest.restoreAllMocks());

test('verifica el sensor y se suscribe a 100 ms', async () => {
  const { result } = await renderHook(() => useShake(jest.fn()));
  await flush();

  expect(result.current.isAvailable).toBe(true);
  expect(accel.setUpdateInterval).toHaveBeenCalledWith(100);
  expect(accel.addListener).toHaveBeenCalledTimes(1);
});

test('sin acelerómetro no se suscribe', async () => {
  accel.isAvailableAsync.mockResolvedValue(false);
  const { result } = await renderHook(() => useShake(jest.fn()));
  await flush();

  expect(result.current.isAvailable).toBe(false);
  expect(accel.addListener).not.toHaveBeenCalled();
});

test('dispara con un agitado, ignora el reposo y respeta el enfriamiento', async () => {
  const onShake = jest.fn();
  const now = jest.spyOn(Date, 'now');
  await renderHook(() => useShake(onShake));
  await flush();

  now.mockReturnValue(10_000);
  emit({ x: 0, y: 0, z: 1 }); // reposo ≈ 1 g
  expect(onShake).not.toHaveBeenCalled();

  emit({ x: 2, y: 1, z: 1 }); // ≈ 2.45 g
  expect(onShake).toHaveBeenCalledTimes(1);

  now.mockReturnValue(10_500); // dentro del enfriamiento de 1000 ms
  emit({ x: 2, y: 1, z: 1 });
  expect(onShake).toHaveBeenCalledTimes(1);

  now.mockReturnValue(11_200);
  emit({ x: 2, y: 1, z: 1 });
  expect(onShake).toHaveBeenCalledTimes(2);
});

test('respeta un umbral personalizado', async () => {
  const onShake = jest.fn();
  jest.spyOn(Date, 'now').mockReturnValue(10_000);
  await renderHook(() => useShake(onShake, { threshold: 3 }));
  await flush();

  emit({ x: 2, y: 1, z: 1 }); // ≈ 2.45 g < 3
  expect(onShake).not.toHaveBeenCalled();
});

test('limpia la suscripción al desmontar', async () => {
  const { unmount } = await renderHook(() => useShake(jest.fn()));
  await flush();
  await unmount();

  expect(remove).toHaveBeenCalledTimes(1);
});

test('desmontar antes de que responda el sensor no deja suscripción', async () => {
  let resolve: (value: boolean) => void = () => undefined;
  accel.isAvailableAsync.mockReturnValue(new Promise((r) => (resolve = r)));

  const { unmount } = await renderHook(() => useShake(jest.fn()));
  await unmount();
  resolve(true);
  await flush();

  expect(accel.addListener).not.toHaveBeenCalled();
});

test('cambiar el callback no reinicia la suscripción', async () => {
  const first = jest.fn();
  const second = jest.fn();
  jest.spyOn(Date, 'now').mockReturnValue(10_000);

  const { rerender } = await renderHook(({ cb }: { cb: () => void }) => useShake(cb), {
    initialProps: { cb: first },
  });
  await flush();
  await rerender({ cb: second });

  emit({ x: 2, y: 1, z: 1 });
  expect(accel.addListener).toHaveBeenCalledTimes(1);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});
