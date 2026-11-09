# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Ricardo Luis Boyacá Pérez, Yeirys Paola Bula Rojano
**Semana:** 9
**Proyecto:** GeoCam sincronizada – Taller Integrador 2
**Herramienta:** Claude Code (Claude Opus 5.5) para el taller en clase y el trabajo para la casa;
la pareja revisa, ejecuta el SQL en Supabase y prueba con dos teléfonos.

> Los logs de las semanas anteriores están en [`docs/`](docs/).

## 1. Prompts Utilizados

- Encargo (resumen del pedido): implementar sobre este repositorio el taller en clase (T1–T7) y el
  trabajo para la casa (C1–C7) de la Guía Semana 9. Como referencia, usar la solución del taller
  que entregó el profesor (`s9-geocam-sync`) y el ejemplo del Muro con TanStack Query
  (`s9-muro-tanstack`). Después, subir el resultado a GitHub.

## 2. Código Generado vs. Código Modificado

- **¿Qué generó la IA?:**
  - El SQL `docs/sql/semana9-geocam.sql` y las migraciones `0005_sync_meta` y `0006_deleted_at`,
    con `drizzle-kit generate`, por separado y sin editar a mano.
  - `services/sync.ts`, `lib/queryClient.ts`, los hooks `useSync`, `useCloudFeed` y
    `useDebouncedValue`, el `SyncBadge`, la pantalla `sincronizacion.tsx` y la nueva pestaña Nube.
  - Los cambios en el repositorio de fotos y la prueba `src/__tests__/sync.test.ts`.
- **Adaptaciones frente a la referencia del profesor:**
  - **Componentes:** la referencia usa NativeWind e `@expo/vector-icons`; este proyecto usa
    `StyleSheet` y no tiene esa librería de íconos. El indicador se rehízo con estilos y símbolos
    de texto.
  - **Fotos por usuario:** la referencia no filtra por usuario; este proyecto sí, desde la tarea C5
    de la Semana 8. Por la pista de la guía, `pendingQuery` y `listPending` filtran por `ownerId`
    e `insertFromRemote` guarda el dueño.
  - **Política de update de T1:** el SQL de la guía crea "editar las mías", pero la Semana 8 ya
    había creado una igual ("actualizar las mías"). No se duplicó.
  - **C5:** en la referencia, la primera foto que falla detiene todo el ciclo. Ahora cada foto
    tiene su propio `try/catch` y la que falla queda pendiente. El ciclo además deja de repetirse
    cuando hay fallas, para no reintentar tres veces seguidas una foto que no puede subir.
  - **Borrado:** se reemplazó el borrado de la Semana 8 (`deletePhotoCoherent`), que exigía
    conexión, por el borrado lógico de C1, que funciona en modo avión.
  - **Caché persistente (C3):** se guarda en `expo-sqlite/kv-store`, compatible con la API de
    AsyncStorage y ya incluido en `expo-sqlite`, en lugar de agregar
    `@react-native-async-storage/async-storage`. Solo se persisten las consultas `['cloud', …]`.
  - **Imágenes de la pestaña Nube:** si la foto existe en el teléfono, se muestra el archivo local
    y no la URL firmada. Así se ve sin conexión aunque la URL guardada haya vencido.
- **Verificación:**
  - `npx tsc --noEmit` y `npx expo lint` pasan sin errores, y las 47 pruebas pasan.
  - Las 16 pruebas nuevas recorren la matriz de C6 sobre el `services/sync.ts` real, con dos
    teléfonos y una nube simulados.
  - Para comprobar que las pruebas detectan errores, se introdujeron a propósito dos de los
    errores de IA que lista la guía y luego se revirtieron. "Subir antes de bajar" hizo fallar 4
    pruebas; `syncedAt = new Date()` hizo fallar 2.
  - Falta la prueba con dos teléfonos físicos (columna "Teléfonos" de la matriz en el README).

## 3. Alucinaciones o Errores Detectados

- **Hueco en el diseño de partida (borrar y editar en paralelo).** Con "gana el último cambio",
  puede pasar esto: B borra una foto (su ciclo elimina el archivo del bucket) y A, sin conexión,
  la edita después. Gana la edición de A, pero A ya tenía `remotePath`, así que no volvía a subir
  el archivo. Resultado: una foto "viva" sin imagen en la nube. Se corrigió en `pull`: si llega un
  borrado remoto y aquí hay una edición más nueva, `clearRemotePath` obliga a subir el archivo de
  nuevo. La prueba "5b" lo cubre.
- **Tipos de rutas desactualizados.** Tras crear `app/sincronizacion.tsx`, `tsc` falló con
  `'"/sincronizacion"' is not assignable`. Expo Router genera los tipos de ruta al arrancar el
  servidor; se resolvió con `npx expo start`, sin escribir a mano el archivo generado.
- **Errores de la tabla de la guía, revisados en el código final:**
  - `useQuery` y `useInfiniteQuery` usan la forma con objeto de la versión 5.
  - `useInfiniteQuery` declara `initialPageParam`.
  - No se usan `cacheTime`, `status === 'loading'` ni `onSuccess` dentro de `useQuery`.
  - La red se detecta con `onlineManager` + `expo-network`, no con `window.addEventListener`.
  - El cursor de bajada usa `server_updated_at`, la subida es upsert por `client_id`, y
    `syncedAt` guarda el `updatedAt` que se subió, nunca la hora actual.
