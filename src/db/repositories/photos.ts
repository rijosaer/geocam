import { and, asc, desc, eq, gt, isNotNull, isNull, like, or, type SQL } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { db } from '@/db/client';
import { photos, type NewPhoto } from '@/db/schema';

type PhotoInput = Omit<
  NewPhoto,
  'id' | 'createdAt' | 'clientId' | 'updatedAt' | 'remotePath' | 'syncedAt' | 'deletedAt'
> & {
  ownerId: string;
};

export interface PhotoFilters {
  ownerId: string;
  search: string;
  albumId: number | null;
  onlyFavorites: boolean;
}

export interface PhotoUpdate {
  note: string | null;
  favorite: boolean;
  albumId: number | null;
}

// Lo que la nube puede cambiar de una foto que ya existe en el teléfono
export interface RemoteChanges {
  note: string | null;
  aiDescription: string | null;
  favorite: boolean;
  deletedAt: Date | null;
  updatedAt: Date;
  syncedAt: Date;
}

// Lo que ve la UI: fotos del usuario que no están marcadas como borradas (C1)
const visible = (ownerId: string): SQL | undefined =>
  and(eq(photos.ownerId, ownerId), isNull(photos.deletedAt));

// Pendiente = nunca se subió o se editó (o se borró) después de la última subida.
// Incluye las marcadas como borradas: la marca también hay que subirla.
const pendingCondition = (ownerId: string): SQL | undefined =>
  and(
    eq(photos.ownerId, ownerId),
    or(isNull(photos.syncedAt), isNull(photos.updatedAt), gt(photos.updatedAt, photos.syncedAt))
  );

export const photosRepo = {
  listQuery(ownerId: string) {
    return db.select().from(photos).where(visible(ownerId)).orderBy(desc(photos.createdAt));
  },
  withLocationQuery(ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(and(visible(ownerId), isNotNull(photos.latitude)))
      .orderBy(desc(photos.createdAt));
  },
  filteredQuery({ ownerId, search, albumId, onlyFavorites }: PhotoFilters) {
    const conditions: (SQL | undefined)[] = [visible(ownerId)];
    if (search !== '') {
      conditions.push(like(photos.note, `%${search}%`));
    }
    if (albumId !== null) {
      conditions.push(eq(photos.albumId, albumId));
    }
    if (onlyFavorites) {
      conditions.push(eq(photos.favorite, true));
    }
    return db
      .select()
      .from(photos)
      .where(and(...conditions))
      .orderBy(desc(photos.createdAt));
  },
  byIdQuery(id: number, ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.id, id), visible(ownerId)));
  },
  findById(id: number, ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.id, id), eq(photos.ownerId, ownerId)))
      .get();
  },
  // Ruta local de cada foto, por clientId: la pestaña Nube muestra el archivo local
  // cuando existe (funciona sin conexión y no gasta datos)
  localUrisQuery(ownerId: string) {
    return db
      .select({ clientId: photos.clientId, uri: photos.uri })
      .from(photos)
      .where(visible(ownerId));
  },
  create(data: PhotoInput) {
    // El UUID se crea aquí y no en el esquema: drizzle-kit generate no puede
    // analizar el esquema si importa expo-crypto (bug de drizzle-kit 0.31)
    return db
      .insert(photos)
      .values({ clientId: Crypto.randomUUID(), updatedAt: new Date(), ...data });
  },
  // Toda edición del usuario deja la foto pendiente de subir de nuevo
  update(id: number, data: Partial<PhotoUpdate>) {
    return db.update(photos).set({ ...data, updatedAt: new Date() }).where(eq(photos.id, id));
  },
  // Descripción de la IA (Semana 10, T5): también cambia updatedAt; sin eso la foto no
  // queda pendiente y la descripción nunca se sube
  setDescription(id: number, aiDescription: string | null) {
    return db.update(photos).set({ aiDescription, updatedAt: new Date() }).where(eq(photos.id, id));
  },
  // Borrar = marcar (C1). La fila y el archivo se van cuando la marca ya está en la nube
  markDeleted(id: number) {
    const now = new Date();
    return db.update(photos).set({ deletedAt: now, updatedAt: now }).where(eq(photos.id, id));
  },
  markAllDeleted(ownerId: string) {
    const now = new Date();
    return db
      .update(photos)
      .set({ deletedAt: now, updatedAt: now })
      .where(visible(ownerId));
  },
  // Borrado físico, solo después de sincronizar la marca (o si la foto nunca se subió)
  purge(id: number) {
    return db.delete(photos).where(eq(photos.id, id));
  },

  // --- Sincronización (Semana 9) ---

  // Consulta sin ejecutar para el contador reactivo de pendientes
  pendingQuery(ownerId: string) {
    return db
      .select({ id: photos.id })
      .from(photos)
      .where(pendingCondition(ownerId));
  },
  listPending(ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(pendingCondition(ownerId))
      .orderBy(asc(photos.createdAt));
  },
  findByClientId(clientId: string) {
    return db.select().from(photos).where(eq(photos.clientId, clientId)).get();
  },
  // Foto que llegó de la nube: nace sincronizada (syncedAt = su updatedAt)
  insertFromRemote(data: NewPhoto) {
    return db.insert(photos).values(data);
  },
  // Versión más nueva de la nube. Nunca usa la hora actual: copia los relojes remotos
  applyRemote(id: number, changes: RemoteChanges) {
    return db.update(photos).set(changes).where(eq(photos.id, id));
  },
  // syncedAt = la versión (updatedAt) que se subió, no "ahora": si el usuario editó la
  // foto mientras subía, su updatedAt es posterior y la foto sigue pendiente
  markSynced(id: number, remotePath: string, syncedAt: Date) {
    return db.update(photos).set({ remotePath, syncedAt }).where(eq(photos.id, id));
  },
  // La nube borró el archivo pero aquí se editó después: se vuelve a subir completo
  clearRemotePath(id: number) {
    return db.update(photos).set({ remotePath: null }).where(eq(photos.id, id));
  },

  // Las fotos de antes de la Semana 8 no tienen clientId ni updatedAt:
  // se rellenan una sola vez al arrancar, después de las migraciones
  async ensureSyncFields() {
    const rows = await db
      .select()
      .from(photos)
      .where(or(isNull(photos.clientId), isNull(photos.updatedAt)));
    for (const row of rows) {
      await db
        .update(photos)
        .set({
          clientId: row.clientId ?? Crypto.randomUUID(),
          updatedAt: row.updatedAt ?? row.createdAt,
        })
        .where(eq(photos.id, row.id));
    }
  },
  // Si otra persona usó este teléfono antes de la semana 8, sus fotos pasan
  // a ser del primer usuario que inicia sesión
  async claimOrphans(ownerId: string) {
    await db.update(photos).set({ ownerId }).where(isNull(photos.ownerId));
  },
};
