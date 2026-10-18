// Única capa que conoce Supabase para las fotos (igual que los repositorios con SQLite).
import { supabase } from '@/lib/supabase';
import { photosRepo } from '@/db/repositories/photos';
import { deletePhotoFile } from '@/services/photoFiles';
import type { Photo } from '@/db/schema';

const BUCKET = 'geocam';

export interface CloudPhoto {
  id: number;
  clientId: string;
  storagePath: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  favorite: boolean;
  source: 'camera' | 'gallery';
  takenAt: string;
  updatedAt: string;
}

export interface SyncProgress {
  done: number;
  total: number;
}

export interface SyncResult {
  total: number;
  ok: number;
  failed: number;
  pendingLeft: number;
}

/** URL temporal para ver un archivo de un bucket privado. */
export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

/** Sube una foto local por su id, cargándola desde el repositorio (T5). */
export async function uploadPhotoById(id: number, userId: string): Promise<void> {
  const photo = photosRepo.findById(id, userId);
  if (!photo) throw new Error('La foto ya no existe en este teléfono');
  await uploadPhoto(photo, userId);
}

export async function uploadPhoto(photo: Photo, userId: string) {
  if (!photo.clientId) {
    throw new Error('La foto no tiene clientId: abre la app de nuevo para completarlo');
  }
  // 1. Archivo local -> ArrayBuffer (en React Native un Blob o FormData produce 0 bytes)
  const arrayBuffer = await fetch(photo.uri).then((res) => res.arrayBuffer());
  // 2. Subir a la carpeta del usuario (lo exige la política del bucket). El nombre es el
  //    clientId: la misma foto siempre va a la misma ruta y el upsert la reemplaza en vez
  //    de duplicarla (C2)
  const path = `${userId}/${photo.clientId}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;
  // 3. Fila remota con los metadatos; upsert por client_id: repetir la subida no crea filas
  //    repetidas ni archivos huérfanos
  const { error: insertError } = await supabase.from('photos').upsert(
    {
      client_id: photo.clientId,
      storage_path: path,
      latitude: photo.latitude,
      longitude: photo.longitude,
      note: photo.note,
      favorite: photo.favorite,
      source: photo.source,
      taken_at: photo.createdAt.toISOString(),
      updated_at: (photo.updatedAt ?? photo.createdAt).toISOString(),
    },
    { onConflict: 'client_id' }
  );
  if (insertError) {
    // Si el archivo sube pero la fila falla, el archivo se borra antes de reportar (C2)
    await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
    throw insertError;
  }
  // 4. Marcar la foto local como sincronizada (sin tocar updatedAt, o volvería a pendiente)
  await photosRepo.markSynced(photo.id, path);
}

/**
 * Sube todas las fotos pendientes (sin sincronizar o editadas después de la última subida),
 * una por una. Un fallo no detiene el resto (C1).
 */
export async function syncPendingPhotos(
  ownerId: string,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> {
  const pending = await photosRepo.listPending(ownerId);
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < pending.length; i++) {
    onProgress?.({ done: i + 1, total: pending.length });
    try {
      await uploadPhoto(pending[i], ownerId);
      ok += 1;
    } catch (e) {
      failed += 1;
      console.warn(`No se pudo subir la foto local ${pending[i].id}`, e);
    }
  }
  const stillPending = await photosRepo.listPending(ownerId);
  return { total: pending.length, ok, failed, pendingLeft: stillPending.length };
}

/** Borra la fila remota y el archivo del bucket (C3). */
export async function deleteRemotePhoto(path: string): Promise<void> {
  // 1. La fila primero: si falla (sin conexión) no se borra nada más
  const { error: rowError } = await supabase.from('photos').delete().eq('storage_path', path);
  if (rowError) throw rowError;
  // 2. El archivo: un archivo sin fila es invisible, una fila sin archivo se ve rota
  const { error: fileError } = await supabase.storage.from(BUCKET).remove([path]);
  if (fileError) console.warn('No se pudo borrar el archivo del bucket', path, fileError);
}

/**
 * Borrado coherente (C3): si la foto está sincronizada, primero la nube y después el
 * teléfono. Sin conexión no se borra nada a medias; lanza error con mensaje legible.
 */
export async function deletePhotoCoherent(photo: Photo): Promise<void> {
  if (photo.remotePath) {
    try {
      await deleteRemotePhoto(photo.remotePath);
    } catch {
      throw new Error('Sin conexión con la nube: no se borró nada. Reintenta con señal.');
    }
  }
  await photosRepo.remove(photo.id);
  deletePhotoFile(photo.uri);
}

/** Fotos del usuario en Supabase, para la pestaña Nube (C4). */
export async function listCloudPhotos(): Promise<CloudPhoto[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .order('taken_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data as Record<string, unknown>[]).map((row) => ({
    id: Number(row.id),
    clientId: String(row.client_id),
    storagePath: String(row.storage_path),
    latitude: (row.latitude as number | null) ?? null,
    longitude: (row.longitude as number | null) ?? null,
    note: (row.note as string | null) ?? null,
    favorite: Boolean(row.favorite),
    source: row.source === 'gallery' ? ('gallery' as const) : ('camera' as const),
    takenAt: String(row.taken_at),
    updatedAt: String(row.updated_at),
  }));
}
