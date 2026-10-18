export type PermissionState =
  | 'checking'
  | 'undetermined'
  | 'granted'
  | 'denied'
  | 'blocked';

export interface Coords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export interface GeoPhoto {
  id: string;
  uri: string;
  coords: Coords | null; // null si el usuario negó la ubicación
  source: 'camera' | 'gallery';
  note: string | null;
  favorite: boolean;
  albumId: number | null;
  createdAt: number;
  remotePath: string | null; // ruta en el bucket, null si nunca se subió
  pendingSync: boolean; // sin subir o editada después de la última subida
}
