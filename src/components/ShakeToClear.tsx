import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { usePhotos } from '@/hooks/usePhotos';
import { useShake } from '@/hooks/useShake';

// Se monta solo con la pestaña visible: al salir, useShake limpia la suscripción
export function ShakeToClear() {
  const { photos, clearAll } = usePhotos();
  const alertOpen = useRef(false);

  const handleShake = useCallback(() => {
    if (alertOpen.current || photos.length === 0) return;
    alertOpen.current = true;
    const close = () => {
      alertOpen.current = false;
    };

    Alert.alert(
      '¿Borrar todas las fotos?',
      `Se eliminarán ${photos.length} foto(s).`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: close },
        {
          text: 'Borrar todo',
          style: 'destructive',
          onPress: () => {
            close();
            clearAll();
          },
        },
      ],
      { cancelable: true, onDismiss: close }
    );
  }, [photos.length, clearAll]);

  useShake(handleShake);

  return null;
}
