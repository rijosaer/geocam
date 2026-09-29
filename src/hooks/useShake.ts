import { useEffect, useRef, useState } from 'react';
import { Accelerometer } from 'expo-sensors';

type AccelerometerSubscription = ReturnType<typeof Accelerometer.addListener>;

export function useShake(
  onShake: () => void,
  options?: { threshold?: number; cooldownMs?: number }
): { isAvailable: boolean | null } {
  const threshold = options?.threshold ?? 1.8; // en g; en reposo la magnitud es ≈ 1
  const cooldownMs = options?.cooldownMs ?? 1000;
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  // El callback va en una ref para no reiniciar la suscripción en cada render
  const onShakeRef = useRef(onShake);
  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    let cancelled = false;
    let subscription: AccelerometerSubscription | null = null;
    let lastShake = 0;

    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (cancelled) return;
        setIsAvailable(available);
        if (!available) return;

        Accelerometer.setUpdateInterval(100);
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          const now = Date.now();
          if (magnitude > threshold && now - lastShake > cooldownMs) {
            lastShake = now;
            onShakeRef.current();
          }
        });
      })
      .catch(() => {
        if (!cancelled) setIsAvailable(false);
      });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [threshold, cooldownMs]);

  return { isAvailable };
}
