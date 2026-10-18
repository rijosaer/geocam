# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Ricardo Luis Boyacá Pérez, Yeirys Paola Bula Rojano
**Semana:** 8
**Proyecto:** GeoCam en la nube – Taller Integrador 2
**Herramientas:** opencode (modelo `opencode/mimo-v2.6-flash-free`) para el taller en clase y el trabajo
para la casa; la persona estudiante revisó, ejecutó el SQL en Supabase y probó en el teléfono.

> El log de la Semana 7 está en [`docs/AI-LOG-semana-7.md`](docs/AI-LOG-semana-7.md).

## 1. Prompts Utilizados

La Semana 8 se hizo con tres encargos a la IA, escritos a partir de la guía de la semana (no se copió
el texto de la guía como prompt: cada encargo pide piezas concretas y da las reglas del proyecto).

**Encargo 1: autenticación y sesión segura (T1, T2)**

> Actúa como desarrollador senior de Expo SDK 57 + TypeScript estricto + Expo Router sobre el proyecto
> GeoCam existente (lee AGENTS.md y el código de la Semana 7 antes de tocar nada; usa StyleSheet, NO
> NativeWind, que no está en el proyecto).
> - Instala `@supabase/supabase-js`, `expo-secure-store` y `expo-crypto` con `npx expo install`.
> - Crea `.env.example` con `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (sin
>   valores), `.env` con las dos llaves vacías, y agrega `.env` a `.gitignore` (la plantilla de Expo solo
>   ignora `.env*.local`).
> - `src/lib/secureStorage.ts`: adaptador de Supabase sobre SecureStore que parte la sesión en fragmentos
>   de 1000 caracteres (el límite por valor es ~2048 bytes y la sesión de Supabase la supera). Prohibido
>   AsyncStorage para la sesión.
> - `src/lib/supabase.ts`: `createClient` con ese storage, `autoRefreshToken`, `persistSession` y
>   `detectSessionInUrl: false`; lanza un error claro si faltan las variables; pausa el auto-refresh con
>   `AppState`. Prohibido cualquier `sb_secret_` o service_role.
> - `src/context/AuthContext.tsx` con `onAuthStateChange`, `signIn`, `signUp` y `signOut` que devuelven
>   el mensaje de error para la UI.
> - `src/app/login.tsx` con correo y contraseña, validación mínima y botones de entrar/crear cuenta.
> - `_layout.tsx`: `Stack.Protected` con `guard={!!session}` para `(tabs)` y `foto/[id]`, y
>   `guard={!session}` para `login`; `index.tsx` queda fuera de ambos grupos y redirige con
>   `<Redirect href={session ? '/geocam' : '/login'} />`. Sin `router.replace` manual.
> - Botón de cerrar sesión visible en la pestaña Fotos.
> - Al iniciar sesión, las fotos locales sin dueño quedan del usuario actual (`claimOrphans`).
> - Termina con `npx tsc --noEmit` y `npx expo lint` sin errores y sin hacer commits.

**Encargo 2: backend, migración local y subida de fotos (T3, T4, T5)**

> Sobre el mismo proyecto, conecta SQLite con Supabase. SQLite sigue siendo la fuente de verdad local.
> - `docs/sql/semana8-geocam.sql`: tabla `photos` remota (`client_id` uuid único, `storage_path`,
>   latitud/longitud, nota, favorita, fuente, `taken_at`, `updated_at`) con RLS por dueño (`auth.uid()`),
>   bucket privado `geocam` con carpeta por usuario y políticas de insert/select/update/delete en
>   `storage.objects`. Agrega la tabla a la publicación `supabase_realtime`. NO incluir service_role.
> - Esquema local: agrega a `photos` las columnas opcionales `clientId`, `updatedAt`, `remotePath` y
>   `syncedAt`; genera la migración con `npx drizzle-kit generate --name sync_fields` (nunca edites los
>   `.sql` ni `meta/` a mano). Después agrega `ownerId` y genera `--name owner_id`.
> - `photosRepo`: `create` genera el `clientId` con `expo-crypto`; `update` escribe siempre
>   `updatedAt` (editar una foto la deja pendiente de subir); `markSynced(id, path)` toca solo
>   `remotePath` y `syncedAt`; `ensureSyncFields()` rellena las fotos de la Semana 7 una sola vez al
>   arrancar.
> - `src/services/cloudPhotos.ts`: `uploadPhoto` sube el archivo como `ArrayBuffer`
>   (`fetch(uri).then(r => r.arrayBuffer())`; Blob/FormData produce 0 bytes) a `<userId>/<clientId>.jpg`
>   y luego inserta la fila; si la fila falla, borra el archivo del bucket antes de reportar.
> - Botón "Subir a la nube" en `foto/[id].tsx` y un ícono de nube ☁ en las miniaturas ya subidas.
> - Termina con `tsc` y `lint` limpios, sin commits.

**Encargo 3: trabajo para la casa (C1–C5)**

> Convierte la subida manual en un respaldo confiable:
> - C1: botón "Sincronizar" en Fotos con avance visible ("Subiendo 3 de 7…"); sube una por una las
>   fotos con `syncedAt` vacío o anterior a `updatedAt`; si una falla las demás continúan y al final se
>   informa cuántas quedaron pendientes.
> - C2: repetir la sincronización no crea filas ni archivos repetidos: ruta fija por `clientId` con
>   `upsert` en Storage y `upsert` por `client_id` en la tabla; si la fila falla tras subir el archivo,
>   el archivo se borra del bucket. La subida de una foto editada reemplaza su copia remota.
> - C3: borrado coherente: si la foto tiene `remotePath`, primero se borra la fila remota y el archivo
>   del bucket y después lo local; sin conexión la app avisa y no borra nada a medias (ni en el borrado
>   masivo al agitar el teléfono).
> - C4: pestaña "Nube" que lista las fotos del usuario desde Supabase con URL firmada (bucket privado),
>   recarga con Realtime sobre `photos` y pull-to-refresh; debe funcionar al iniciar sesión en otro
>   teléfono.
> - C5: todas las consultas de fotos se filtran por el `ownerId` de la sesión (columna nueva con su
>   migración); los álbumes siguen siendo locales compartidos en el teléfono.
> - Verifica con `tsc`, `lint` y `npm test`; ejecuta los comandos de auditoría de credenciales
>   (`git log --all --full-history -- .env`, búsqueda de `sb_secret|service_role`); no hagas commits.

## 2. Código Generado vs. Código Modificado

- **¿Qué generó la IA?:** `lib/secureStorage.ts` y `lib/supabase.ts`; `context/AuthContext.tsx`;
  `app/login.tsx`; el `Stack.Protected` del layout y el redirect de `index.tsx`; el SQL del taller;
  las migraciones `0003_sync_fields` y `0004_owner_id` (con `npx drizzle-kit generate`); las columnas
  nuevas del esquema; los métodos del repositorio (`ensureSyncFields`, `markSynced`, `listPending`,
  `claimOrphans`); `services/cloudPhotos.ts`; los hooks `useSync` y `useCloudPhotos`; la pestaña Nube;
  el botón de subir en el detalle; el botón Sincronizar y el ícono de nube en Fotos.
- **¿Qué modifiqué/corregí?:**
  - La guía propone `$defaultFn(() => Crypto.randomUUID())` dentro del esquema, pero `drizzle-kit
    generate` falla al analizar el esquema si importa `expo-crypto` (bug drizzle-team/drizzle-orm#4961:
    esbuild intenta transformar `react-native`/`expo-modules-core`). El UUID se genera ahora en
    `photosRepo.create` y en `ensureSyncFields`, y el esquema no importa módulos nativos.
  - El SQL de la guía no incluye políticas de UPDATE. Sin ellas, re-subir una foto editada (pendiente
    por `updatedAt > syncedAt`) falla al hacer upsert. Se agregaron las políticas "actualizar las mías"
    y "actualizar mi carpeta", además de `alter publication supabase_realtime add table public.photos`
    para el tiempo real de la pestaña Nube (C4).
  - La guía escribe el login con NativeWind; GeoCam no lo usa (todo StyleSheet), así que la pantalla se
    escribió con StyleSheet y la paleta existente de la app.
  - `deletePhoto` ahora devuelve el mensaje de error (o `null` si salió bien): Mapa, el detalle y el
    borrado masivo al agitar muestran un Alert si el borrado falla, en vez de ignorarlo. `clearAll`
    también borra la nube antes que lo local.
  - `drizzle-kit` no puede generar desde un esquema que importa módulos Expo: se documentó en el propio
    esquema por qué el default vive en el repositorio.
- **Verificación:** `npx tsc --noEmit` y `npx expo lint` sin errores; 31 pruebas de jest pasan; las
  migraciones 0003 y 0004 se generaron sin editar `.sql` ni `meta/` a mano.

## 3. Alucinaciones o Errores Detectados

- **Service role en la app.** El error clásico de la semana es que la IA ponga la secret key o
  `SUPABASE_SERVICE_ROLE_KEY` en el cliente "para que funcione" (salta el RLS y deja la base abierta
  desde cualquier APK). En el código solo vive la publishable key; la auditoría
  `git grep -nE 'sb_secret|service_role'` no arroja resultados y `git log --all --full-history -- .env`
  está vacío.
- **"Desactiva RLS para que la consulta devuelva datos".** Si la consulta de la nube sale vacía sin
  error, casi siempre faltan políticas o no hay sesión; desactivar RLS abriría la tabla a cualquiera con
  la publishable key. El SQL completo con políticas quedó en `docs/sql/semana8-geocam.sql` para
  ejecutarlo en el panel.
- **Subir con Blob o FormData.** En React Native produce archivos de 0 bytes; se usa
  `ArrayBuffer` con `fetch(uri)`, como exige la guía, y el tipo de contenido se declara explícito.
- **`markSynced` tocando `updatedAt`.** Si marcar la sincronización escribiera también `updatedAt`, la
  foto quedaría pendiente para siempre en un bucle infinito. El método escribe solo `remotePath` y
  `syncedAt`.
- **Llave que llega a GitHub.** Borrarla en un commit posterior no sirve (queda en el historial): hay
  que rotarla en el panel. Por eso `.env` está en `.gitignore` desde el primer commit de la semana y
  solo se versiona `.env.example`.

## 4. Credenciales (auditoría C6)

```bash
git log --all --full-history -- .env      # sin resultados: .env nunca entró al historial
git grep -nE 'sb_secret|service_role'     # sin resultados en el código
ls .env .env.example                      # .env local ignorado, .env.example versionado
```
