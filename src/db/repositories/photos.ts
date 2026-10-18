import { and, desc, eq, isNotNull, isNull, like, lt, or, type SQL } from 'drizzle-orm';
import * as Crypto from 'expo-crypto';
import { db } from '@/db/client';
import { photos, type NewPhoto } from '@/db/schema';

type PhotoInput = Omit<NewPhoto, 'id' | 'createdAt' | 'clientId' | 'updatedAt' | 'remotePath' | 'syncedAt'> & {
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

// Una foto está pendiente si nunca se subió o si se editó después de la última subida
const pendingCondition = (ownerId: string): SQL | undefined =>
  and(
    eq(photos.ownerId, ownerId),
    or(isNull(photos.syncedAt), isNull(photos.updatedAt), lt(photos.syncedAt, photos.updatedAt))
  );

export const photosRepo = {
  listQuery(ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(eq(photos.ownerId, ownerId))
      .orderBy(desc(photos.createdAt));
  },
  withLocationQuery(ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.ownerId, ownerId), isNotNull(photos.latitude)))
      .orderBy(desc(photos.createdAt));
  },
  filteredQuery({ ownerId, search, albumId, onlyFavorites }: PhotoFilters) {
    const conditions: SQL[] = [eq(photos.ownerId, ownerId)];
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
      .where(and(eq(photos.id, id), eq(photos.ownerId, ownerId)));
  },
  findById(id: number, ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(and(eq(photos.id, id), eq(photos.ownerId, ownerId)))
      .get();
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
  // Solo remotePath y syncedAt: tocar updatedAt dejaría la foto pendiente otra vez
  markSynced(id: number, remotePath: string) {
    return db
      .update(photos)
      .set({ remotePath, syncedAt: new Date() })
      .where(eq(photos.id, id));
  },
  remove(id: number) {
    return db.delete(photos).where(eq(photos.id, id));
  },
  listAll(ownerId: string) {
    return db.select().from(photos).where(eq(photos.ownerId, ownerId));
  },
  clearAll(ownerId: string) {
    return db.delete(photos).where(eq(photos.ownerId, ownerId));
  },
  listPending(ownerId: string) {
    return db
      .select()
      .from(photos)
      .where(pendingCondition(ownerId))
      .orderBy(photos.createdAt);
  },
  countPending(ownerId: string) {
    return db
      .select({ id: photos.id })
      .from(photos)
      .where(pendingCondition(ownerId))
      .all().length;
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
