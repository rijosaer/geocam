import { index, sqliteTable, integer, real, text } from 'drizzle-orm/sqlite-core';

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
  // Borrado lógico (Semana 9, C1): la foto se marca, la marca se sincroniza y solo
  // después se borran la fila y los archivos
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  // Descripción sugerida por la IA y revisada por el usuario (Semana 10, T3)
  aiDescription: text('ai_description'),
});

// Pares clave-valor de la sincronización: cursor de bajada y último resultado (Semana 9, T3)
export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// Historial del Tutor IA (Semana 10, C1). Cada fila es un UIMessage del AI SDK: el id lo
// genera useChat y se guarda con upsert, así reescribir la conversación no duplica nada.
export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    conversationId: text('conversation_id').notNull(),
    role: text('role', { enum: ['system', 'user', 'assistant'] }).notNull(),
    // Las partes del mensaje (texto, fotos como data URL) en JSON
    parts: text('parts').notNull(),
    // Orden dentro de la conversación (posición en el arreglo de useChat)
    position: integer('position').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index('chat_messages_conversation_idx').on(t.ownerId, t.conversationId, t.position)]
);

// Perfil del estudiante para el Tutor IA (Semana 10, C2). Uno por cuenta.
export const profiles = sqliteTable('profiles', {
  ownerId: text('owner_id').primaryKey(),
  name: text('name').notNull().default(''),
  topic: text('topic').notNull().default('general'),
  level: text('level').notNull().default('basico'),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;
export type ChatMessageRow = typeof chatMessages.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
