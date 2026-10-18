# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Ricardo Luis Boyacá Pérez, Yeirys Paola Bula Rojano
**Semana:** 7
**Proyecto:** GeoCam persistente – Taller Integrador 2
**Herramientas:** opencode (modelo `opencode/big-pickle`) para generar el código del trabajo para la casa;
Claude Code (Claude Opus 5.5) para el taller en clase y para revisar, probar y corregir lo que generó opencode.

> El log de la Semana 6 está en [`docs/AI-LOG-semana-6.md`](docs/AI-LOG-semana-6.md).

## 1. Prompts Utilizados

El taller en clase (reemplazar `GeoPhotosContext` por SQLite + Drizzle, pasos 2, 4 y 5 de la guía) se hizo
con Claude Code a partir de la guía. El trabajo para la casa se dividió en dos encargos a opencode,
que se ejecutaron tal cual (aquí se resumen; el texto completo pedía además leer los archivos existentes,
no hacer commits y correr `tsc` y `lint` al final).

**Encargo 1: capa de datos (C1, C2, C5)**

> Actúa como desarrollador senior de React Native (Expo SDK 57, Expo Router, TypeScript estricto) con
> Drizzle ORM sobre expo-sqlite. En esta tarea trabaja SOLO la capa de datos; no toques pantallas.
> - C1: tabla `albums` (`id`, `name` único, `createdAt`) y en `photos` la columna
>   `albumId` con `references(() => albums.id, { onDelete: 'set null' })`, opcional.
>   Genera la migración con `npx drizzle-kit generate --name albums`.
> - C2: después, agrega `note` (texto opcional) y `favorite` (`integer` modo boolean, por defecto `false`).
>   Genera la migración con `npx drizzle-kit generate --name note_favorite`. Las fotos existentes deben conservarse.
> - Repositorios: `albumsRepo` (`listQuery`, `create`, `remove`) y en `photosRepo`: `findById`, `update`,
>   `filteredQuery({ search, albumId, onlyFavorites })` sin ejecutar (para `useLiveQuery`) combinando
>   con `and(...)` solo las condiciones activas, y `listUris`.
> - C5: `src/services/photoFiles.ts` con la API NUEVA de expo-file-system (`File`, `Directory`, `Paths`).
>   PROHIBIDO usar `expo-file-system/legacy`, `FileSystem.copyAsync` o mezclar ambas APIs.
>   `addPhoto` guarda la ruta permanente; `removePhoto` y `clearAll` borran también los archivos.
> - Reglas: nunca edites un `.sql` ni `meta/` a mano, nunca uses `drizzle-kit push`; solo los repositorios
>   conocen Drizzle.

**Encargo 2: pantallas (C3, C4)**

> La capa de datos ya está lista; construye las pantallas sin cambiar el esquema.
> - Hooks: `useAlbums` (con error legible si el nombre ya existe), un hook de filtros que use
>   `useLiveQuery(photosRepo.filteredQuery(filtros), [search, albumId, onlyFavorites])` y `usePhoto(id)`
>   con `setNote`, `toggleFavorite`, `moveToAlbum` y `remove` (que borre también el archivo).
> - C4: pestaña `fotos.tsx` con buscador por nota, chip "Solo favoritas", chips de álbum, crear álbum
>   y eliminarlo con pulsación larga + confirmación; lista con miniatura, ★ y nota.
> - C3: `src/app/foto/[id].tsx` para ver la foto, editar la nota, marcar favorita, moverla de álbum y
>   eliminarla con confirmación.
> - Cambia el `<Slot />` del layout raíz por un `<Stack>` conservando intacta la lógica de `useMigrations`.
> - Las pantallas NO importan nada de `drizzle-orm` ni de `@/db/...`.

## 2. Código Generado vs. Código Modificado

- **¿Qué generó la IA?:** el esquema con `albums`, `note` y `favorite`; las migraciones `0001_albums` y
  `0002_note_favorite` (con `drizzle-kit generate`); `albumsRepo` y las funciones nuevas de `photosRepo`;
  `services/photoFiles.ts`; los hooks `useAlbums`, `usePhotoFilters` y `usePhoto`; la pestaña Fotos y la
  pantalla de detalle `foto/[id]`.
- **¿Qué modifiqué/corregí?:**
  - `usePhoto` cargaba **toda** la tabla de fotos con `useLiveQuery(listQuery())` y buscaba la foto con
    `rows.find(...)` en memoria. Se agregó `photosRepo.byIdQuery(id)` y el hook ahora hace
    `useLiveQuery(byIdQuery(id), [id])`.
  - `usePhoto` llamaba a `usePhotos()` completo (dos consultas reactivas más) solo para reutilizar
    `removePhoto`. Se extrajo `deletePhoto(id)` (borra registro y archivo), que comparten ambos hooks.
  - `deletePhotoFile` lanzaba una excepción si el archivo no se podía borrar, aunque el registro ya se
    hubiera eliminado. Ahora la captura y deja un aviso en consola.
- **Verificación:** `npx tsc --noEmit` y `npx expo lint` sin errores; 31 pruebas de jest pasan. Las tres
  migraciones se aplicaron sobre una base SQLite con una foto creada antes de C1/C2: la foto se conserva
  con `note = null`, `favorite = 0` y `album_id = null`.

## 3. Alucinaciones o Errores Detectados

- **`onDelete: 'set null'` no llegó a la base de datos.** El esquema lo declara, pero `drizzle-kit generate`
  produjo `ALTER TABLE photos ADD album_id integer REFERENCES albums(id);` sin la acción `ON DELETE`
  (SQLite agrega la columna con `ALTER TABLE` y drizzle-kit omite la acción referencial). Como el cliente
  activa `PRAGMA foreign_keys = ON`, borrar un álbum con fotos falla. Se reprodujo aplicando las migraciones
  en una base de prueba:

  ```
  DELETE directo del álbum falla: FOREIGN KEY constraint failed
  ```

  No se editó la migración (la regla del curso lo prohíbe). `albumsRepo.remove` ejecuta una transacción que
  primero pone `album_id = NULL` en las fotos del álbum y luego borra el álbum; con eso las fotos quedan
  sin álbum y no se borran (verificado en la misma prueba).
- **API de `expo-file-system`:** no hubo mezcla de API. El prompt lo prohibía de forma explícita porque la
  guía lo señala como alucinación frecuente, y opencode consultó los tipos instalados
  (`node_modules/expo-file-system/build/*.d.ts`, SDK 57) antes de escribir el servicio. Se revisó a mano:
  solo usa `File`, `Directory` y `Paths`.
- **`.expo/types/router.d.ts` editado a mano:** opencode regeneró a mano ese archivo para que `tsc`
  reconociera las rutas nuevas. Es un archivo generado e ignorado por Git que Expo sobrescribe en el
  siguiente `expo start`, así que no afecta la entrega, pero no es una práctica correcta: lo indicado es
  correr `npx expo start` para que Expo lo regenere.
