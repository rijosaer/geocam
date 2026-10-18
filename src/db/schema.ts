import { sqliteTable, integer, real, text } from 'drizzle-orm/sqlite-core';

export const albums = sqliteTable('albums', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const photos = sqliteTable('photos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  uri: text('uri').notNull(),
  latitude: real('latitude'),
  longitude: real('longitude'),
  accuracy: real('accuracy'),
  source: text('source', { enum: ['camera', 'gallery'] }).notNull(),
  note: text('note'),
  favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
  albumId: integer('album_id').references(() => albums.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  // Identidad compartida con la nube: se genera en el teléfono, desde el repositorio
  // (no con $defaultFn: drizzle-kit generate falla si el esquema importa expo-crypto)
  clientId: text('client_id').unique(),
  // Última modificación hecha por el usuario (una foto está pendiente si syncedAt < updatedAt)
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$defaultFn(() => new Date()),
  // Ruta del archivo en el bucket y momento de la última sincronización
  remotePath: text('remote_path'),
  syncedAt: integer('synced_at', { mode: 'timestamp_ms' }),
  // Dueño de la sesión a la que pertenecen los datos locales (Semana 8, C5)
  ownerId: text('owner_id'),
});

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;
