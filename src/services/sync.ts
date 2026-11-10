// Semana 9: sincronización en dos sentidos entre SQLite (fuente de verdad) y Supabase.
// Cada ciclo: 1) bajar lo que cambió en la nube, 2) subir lo pendiente.
// Regla de conflicto: gana el último cambio (updatedAt más reciente). Un borrado es un cambio más.
import { photosRepo } from '@/db/repositories/photos';
import { syncMetaRepo } from '@/db/repositories/syncMeta';
import {
  fetchChangesSince,
  removeRemoteFile,
  upsertRemotePhoto,
  uploadPhotoFile,
  type RemotePhotoUpsert,
} from '@/services/cloudPhotos';
import { deletePhotoFile, downloadPhotoFile } from '@/services/photoFiles';
import type { Photo } from '@/db/schema';

export interface SyncResult {
  pulled: number; // cambios de la nube aplicados en este teléfono
  pushed: number; // fotos (o marcas de borrado) subidas
  failed: number; // fotos que no se pudieron subir y siguen pendientes (C5)
  lastError: string | null;
  finishedAt: number;
}

const EPOCH = '1970-01-01T00:00:00Z';
const cursorKey = (userId: string) => `lastPulledAt:${userId}`;
export const lastResultKey = (userId: string) => `lastSync:${userId}`;

/** Gana el último cambio. Con fechas iguales no gana nadie: ya están sincronizados. */
export function remoteWins(localUpdatedAt: Date | null, remoteUpdatedAt: string): boolean {
  return new Date(remoteUpdatedAt).getTime() > (localUpdatedAt?.getTime() ?? 0);
}

/** Pendiente = nunca se subió o se editó después de la última subida. */
export function isPending(photo: { syncedAt: Date | null; updatedAt: Date | null }): boolean {
  if (!photo.syncedAt || !photo.updatedAt) return true;
  return photo.updatedAt.getTime() > photo.syncedAt.getTime();
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Bajar: solo lo que llegó al servidor después del cursor. */
async function pull(userId: string): Promise<number> {
  const since = (await syncMetaRepo.get(cursorKey(userId))) ?? EPOCH;
  const changes = await fetchChangesSince(since);

  let applied = 0;
  for (const remote of changes) {
    const local = await photosRepo.findByClientId(remote.client_id);
    const remoteUpdatedAt = new Date(remote.updated_at);
    const remoteDeleted = remote.deleted_at !== null;

    if (!local) {
      // Foto creada en otro teléfono. Si ya viene borrada, no hay nada que traer.
      if (!remoteDeleted) {
        const uri = await downloadPhotoFile(remote.storage_path, remote.client_id);
        await photosRepo.insertFromRemote({
          clientId: remote.client_id,
          ownerId: userId,
          uri,
          latitude: remote.latitude,
          longitude: remote.longitude,
          note: remote.note,
          aiDescription: remote.ai_description,
          favorite: remote.favorite,
          source: remote.source,
          createdAt: new Date(remote.taken_at),
          updatedAt: remoteUpdatedAt,
          remotePath: remote.storage_path,
          syncedAt: remoteUpdatedAt, // nace sincronizada
        });
        applied++;
      }
    } else if (remoteWins(local.updatedAt, remote.updated_at)) {
      if (remoteDeleted) {
        // Otro teléfono la borró después de la última edición de aquí: se borra (C1)
        await photosRepo.purge(local.id);
        deletePhotoFile(local.uri);
      } else {
        // La versión de la nube es más nueva: se aplica con sus relojes, nunca con "ahora"
        await photosRepo.applyRemote(local.id, {
          note: remote.note,
          aiDescription: remote.ai_description,
          favorite: remote.favorite,
          deletedAt: null,
          updatedAt: remoteUpdatedAt,
          syncedAt: remoteUpdatedAt,
        });
      }
      applied++;
    } else if (remoteDeleted && !local.deletedAt) {
      // Aquí se editó DESPUÉS del borrado remoto: gana la edición. El archivo del bucket
      // pudo haberse borrado ya, así que se vuelve a subir completo.
      await photosRepo.clearRemotePath(local.id);
    }
    // Si la versión local es más nueva no se toca: push la sube enseguida

    // El cursor avanza fila por fila: si algo falla, el siguiente intento sigue desde aquí
    await syncMetaRepo.set(cursorKey(userId), remote.server_updated_at);
  }
  return applied;
}

function toRemoteRow(photo: Photo, path: string, updatedAt: Date): RemotePhotoUpsert {
  return {
    client_id: photo.clientId!,
    storage_path: path,
    latitude: photo.latitude,
    longitude: photo.longitude,
    note: photo.note,
    ai_description: photo.aiDescription,
    favorite: photo.favorite,
    source: photo.source,
    taken_at: photo.createdAt.toISOString(),
    updated_at: updatedAt.toISOString(),
    deleted_at: photo.deletedAt ? photo.deletedAt.toISOString() : null,
  };
}

/** Sube una foto pendiente (o su marca de borrado). Repetirla no duplica nada. */
async function pushOne(photo: Photo, userId: string): Promise<void> {
  if (!photo.clientId) throw new Error('La foto no tiene clientId');
  const updatedAt = photo.updatedAt ?? photo.createdAt;

  if (photo.deletedAt) {
    // C1: si nunca llegó a la nube, basta con borrarla aquí
    if (photo.remotePath) {
      // 1. La marca sube primero: así los demás teléfonos se enteran del borrado
      await upsertRemotePhoto(toRemoteRow(photo, photo.remotePath, updatedAt));
      // 2. Con la marca ya en la nube, se borra el archivo del bucket
      await removeRemoteFile(photo.remotePath);
    }
    // 3. Y al final la fila y el archivo locales
    await photosRepo.purge(photo.id);
    deletePhotoFile(photo.uri);
    return;
  }

  const path = photo.remotePath ?? `${userId}/${photo.clientId}.jpg`;
  // 1. El archivo solo se sube la primera vez
  if (!photo.remotePath) await uploadPhotoFile(path, photo.uri);
  // 2. upsert por client_id: crea la fila o la actualiza, nunca la duplica
  await upsertRemotePhoto(toRemoteRow(photo, path, updatedAt));
  // 3. syncedAt = la versión que se subió, no "ahora"
  await photosRepo.markSynced(photo.id, path, updatedAt);
}

/** Subir todo lo pendiente. Una foto que falla no detiene a las demás (C5). */
async function push(userId: string) {
  const pending = await photosRepo.listPending(userId);
  let pushed = 0;
  let failed = 0;
  let lastError: string | null = null;
  for (const photo of pending) {
    try {
      await pushOne(photo, userId);
      pushed++;
    } catch (e) {
      // Queda pendiente y se reintenta en el siguiente ciclo
      failed++;
      lastError = errorMessage(e);
      console.warn(`No se pudo subir la foto ${photo.clientId}`, e);
    }
  }
  return { pushed, failed, lastError };
}

async function runSync(userId: string): Promise<SyncResult> {
  const result: SyncResult = { pulled: 0, pushed: 0, failed: 0, lastError: null, finishedAt: 0 };
  try {
    // Si el usuario editó algo durante el ciclo, se repite (máximo 3 vueltas)
    for (let round = 0; round < 3; round++) {
      result.pulled += await pull(userId); // primero bajar...
      const pushRound = await push(userId); // ...después subir
      result.pushed += pushRound.pushed;
      result.failed = pushRound.failed;
      result.lastError = pushRound.lastError;
      if (pushRound.pushed === 0 || pushRound.failed > 0) break;
      if ((await photosRepo.listPending(userId)).length === 0) break;
    }
  } catch (e) {
    // Falló la bajada o la red: se guarda para la pantalla de estado y TanStack Query reintenta
    result.lastError = errorMessage(e);
    result.finishedAt = Date.now();
    await syncMetaRepo.set(lastResultKey(userId), JSON.stringify({ ...result, ok: false }));
    throw e;
  }
  result.finishedAt = Date.now();
  await syncMetaRepo.set(lastResultKey(userId), JSON.stringify({ ...result, ok: true }));
  return result;
}

// Un solo ciclo a la vez: si llega otra petición mientras hay uno en curso, se reutiliza
let running: Promise<SyncResult> | null = null;

/** Un ciclo completo de sincronización. Seguro de llamar varias veces seguidas. */
export function syncAll(userId: string): Promise<SyncResult> {
  if (!running) {
    running = runSync(userId).finally(() => {
      running = null;
    });
  }
  return running;
}
