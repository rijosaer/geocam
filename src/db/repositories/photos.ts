import { and, desc, eq, isNotNull, like, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { photos, type NewPhoto } from '@/db/schema';

type PhotoInput = Omit<NewPhoto, 'id' | 'createdAt'>;

export interface PhotoFilters {
  search: string;
  albumId: number | null;
  onlyFavorites: boolean;
}

export interface PhotoUpdate {
  note: string | null;
  favorite: boolean;
  albumId: number | null;
}

export const photosRepo = {
  listQuery() {
    return db.select().from(photos).orderBy(desc(photos.createdAt));
  },
  withLocationQuery() {
    return db
      .select()
      .from(photos)
      .where(isNotNull(photos.latitude))
      .orderBy(desc(photos.createdAt));
  },
  filteredQuery({ search, albumId, onlyFavorites }: PhotoFilters) {
    const conditions: SQL[] = [];
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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(photos.createdAt));
  },
  byIdQuery(id: number) {
    return db.select().from(photos).where(eq(photos.id, id));
  },
  findById(id: number) {
    return db.select().from(photos).where(eq(photos.id, id)).get();
  },
  create(data: PhotoInput) {
    return db.insert(photos).values(data);
  },
  update(id: number, data: Partial<PhotoUpdate>) {
    return db.update(photos).set(data).where(eq(photos.id, id));
  },
  remove(id: number) {
    return db.delete(photos).where(eq(photos.id, id));
  },
  listUris() {
    return db.select({ uri: photos.uri }).from(photos);
  },
  clearAll() {
    return db.delete(photos);
  },
};
