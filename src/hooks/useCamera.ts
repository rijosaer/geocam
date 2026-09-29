import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import {
  CameraView,
  useCameraPermissions,
  type CameraCapturedPicture,
  type CameraType,
} from 'expo-camera';
import type { PermissionState } from '@/types/geo';

export function useCamera() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isReady, setIsReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // El state no se actualiza a tiempo en un doble toque; la ref sí
  const capturingRef = useRef(false);

  // Al volver de Ajustes, volver a consultar el permiso
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') getPermission().catch(() => undefined);
    });
    return () => sub.remove();
  }, [getPermission]);

  const permissionState: PermissionState = !permission
    ? 'checking'
    : permission.granted
      ? 'granted'
      : !permission.canAskAgain
        ? 'blocked'
        : permission.status === 'undetermined'
          ? 'undetermined'
          : 'denied';

  const toggleFacing = useCallback(() => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }, []);

  const onCameraReady = useCallback(() => setIsReady(true), []);

  const openSettings = useCallback(() => Linking.openSettings(), []);

  const takePhoto = useCallback(async (): Promise<CameraCapturedPicture | null> => {
    if (!cameraRef.current || !isReady || capturingRef.current) return null;
    capturingRef.current = true;
    setIsCapturing(true);
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      return photo ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo tomar la foto');
      return null;
    } finally {
      capturingRef.current = false;
      setIsCapturing(false);
    }
  }, [isReady]);

  return {
    cameraRef,
    permissionState,
    requestPermission,
    openSettings,
    facing,
    toggleFacing,
    onCameraReady,
    takePhoto,
    isCapturing,
    error,
  };
}
