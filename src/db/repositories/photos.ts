import { desc, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { photos, type NewPhoto } from '@/db/schema';

type PhotoInput = Omit<NewPhoto, 'id' | 'createdAt'>;

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
  create(data: PhotoInput) {
    return db.insert(photos).values(data);
  },
  remove(id: number) {
    return db.delete(photos).where(eq(photos.id, id));
  },
  clearAll() {
    return db.delete(photos);
  },
};
