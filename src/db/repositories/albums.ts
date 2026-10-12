import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { albums, photos } from '@/db/schema';

export const albumsRepo = {
  listQuery() {
    return db.select().from(albums).orderBy(asc(albums.name));
  },
  create(name: string) {
    return db.insert(albums).values({ name });
  },
  remove(id: number) {
    return db.transaction((tx) => {
      tx.update(photos).set({ albumId: null }).where(eq(photos.albumId, id)).run();
      tx.delete(albums).where(eq(albums.id, id)).run();
    });
  },
};
