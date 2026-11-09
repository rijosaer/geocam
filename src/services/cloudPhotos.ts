// Única capa que conoce Supabase para las fotos (igual que los repositorios con SQLite).
import { File } from 'expo-file-system';
import { supabase } from '@/lib/supabase';

export const BUCKET = 'geocam';
const FEED_PAGE_SIZE = 10;
const SIGNED_URL_SECONDS = 3600;

// Fila de la tabla remota tal como la guarda PostgreSQL
export interface RemotePhoto {
  client_id: string;
  storage_path: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  favorite: boolean;
  source: 'camera' | 'gallery';
  taken_at: string;
  updated_at: string; // reloj del teléfono: decide conflictos
  server_updated_at: string; // reloj del servidor: cursor de bajada
  deleted_at: string | null; // borrado lógico (C1)
}

export type RemotePhotoUpsert = Omit<RemotePhoto, 'server_updated_at'>;

// Foto de la nube lista para la pestaña Nube
export interface CloudPhoto {
  clientId: string;
  storagePath: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  favorite: boolean;
  source: 'camera' | 'gallery';
  takenAt: string;
  imageUrl: string | null; // URL firmada; null si no se pudo firmar
}

export interface CloudPage {
  items: CloudPhoto[];
  nextCursor: string | null;
}

/** URL temporal para ver un archivo de un bucket privado. */
export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

// --- Sincronización ---

/** Filas que llegaron al servidor después del cursor, en orden (incluye las borradas). */
export async function fetchChangesSince(since: string, limit = 200): Promise<RemotePhoto[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .gt('server_updated_at', since)
    .order('server_updated_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data as RemotePhoto[];
}

/** Sube el archivo. "Ya existe" no es error: un intento anterior lo subió sin guardar la fila. */
export async function uploadPhotoFile(path: string, localUri: string): Promise<void> {
  // Se lee con la API de archivos y no con fetch(file://): si fetch no encuentra el archivo
  // devuelve el texto "File not found" como contenido y se subiría eso como si fuera la foto
  const file = new File(localUri);
  if (!file.exists) throw new Error('El archivo de la foto ya no existe en este teléfono');
  const arrayBuffer = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: 'image/jpeg' });
  if (error && !/exists/i.test(error.message)) throw error;
}

/** upsert por client_id: crea la fila o la actualiza, nunca la duplica (idempotente). */
export async function upsertRemotePhoto(row: RemotePhotoUpsert): Promise<void> {
  const { error } = await supabase.from('photos').upsert(row, { onConflict: 'client_id' });
  if (error) throw error;
}

/** Borra el archivo del bucket. La fila se queda con deleted_at para que los demás se enteren. */
export async function removeRemoteFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

// --- Feed de la pestaña Nube (C2) ---

/** Una página del feed, por cursor (taken_at), con búsqueda por nota. */
export async function listCloudPhotosPage(params: {
  cursor: string | null;
  search: string;
}): Promise<CloudPage> {
  let query = supabase
    .from('photos')
    .select('client_id, storage_path, latitude, longitude, note, favorite, source, taken_at')
    .is('deleted_at', null)
    .order('taken_at', { ascending: false })
    .limit(FEED_PAGE_SIZE);

  // Paginación por cursor: "las 10 anteriores a la última que ya tengo"
  if (params.cursor) query = query.lt('taken_at', params.cursor);
  const term = params.search.trim();
  if (term) query = query.ilike('note', `%${term}%`);

  const { data, error } = await query;
  if (error) throw error;
  const rows = data as Omit<RemotePhoto, 'updated_at' | 'server_updated_at' | 'deleted_at'>[];

  // Una sola petición firma todas las imágenes de la página (el bucket es privado)
  const urls = new Map<string, string>();
  if (rows.length > 0) {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(
        rows.map((r) => r.storage_path),
        SIGNED_URL_SECONDS
      );
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    }
  }

  return {
    items: rows.map((r) => ({
      clientId: r.client_id,
      storagePath: r.storage_path,
      latitude: r.latitude,
      longitude: r.longitude,
      note: r.note,
      favorite: r.favorite,
      source: r.source,
      takenAt: r.taken_at,
      imageUrl: urls.get(r.storage_path) ?? null,
    })),
    nextCursor: rows.length === FEED_PAGE_SIZE ? rows[rows.length - 1].taken_at : null,
  };
}
