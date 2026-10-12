# Registro de Auditoría de IA (AI-LOG)

**Estudiante(s):** Ricardo Luis Boyacá Pérez
**Semana:** 6
**Proyecto:** GeoCam – Taller Integrador 2
**Herramienta:** Claude Code (Claude Opus 5.5)

## 1. Prompts Utilizados

- Prompt principal (se ejecutó tal cual):

  > Actúa como desarrollador senior de React Native con Expo SDK 54, Expo Router y TypeScript estricto.
  > Implementa el taller "GeoCam completa" de la Guía Semana 6, partiendo del código de la práctica guiada
  > (types/geo.ts, useGeoLocation, useCamera, PermissionPrimer y la pantalla GeoCam).
  >
  > Requisitos:
  > - R1: `context/GeoPhotosContext.tsx` con `addPhoto`, `removePhoto` y `clearAll`, actualizaciones inmutables,
  >   Provider en `app/(tabs)/_layout.tsx`. GeoCam usa `addPhoto` en lugar del estado local `lastPhoto`.
  > - R2: botón de galería con `expo-image-picker` (`mediaTypes: ['images']`); la foto se guarda con
  >   `source: 'gallery'` y las coordenadas actuales o `coords: null`; se distingue visualmente de las de cámara.
  > - R3: `app/(tabs)/mapa.tsx` con un `Marker` por foto con coordenadas; al tocarlo se ve la miniatura.
  >   Las fotos sin coordenadas se listan aparte como "Sin ubicación". El mapa se centra en mi ubicación
  >   o, sin permiso, en la última foto.
  > - R4: `hooks/useShake.ts` con la firma
  >   `useShake(onShake, options?: { threshold?; cooldownMs? }): { isAvailable: boolean | null }`:
  >   `isAvailableAsync()` antes de suscribirse, `setUpdateInterval(100)`, umbral sobre √(x²+y²+z²),
  >   enfriamiento y limpieza con bandera `cancelled`. Al agitar, un `Alert` pregunta si se borran todas las fotos.
  >
  > Restricciones:
  > - Solo APIs actuales: `CameraView` + `useCameraPermissions()`, permisos desde cada módulo (nada de
  >   `expo-permissions`), `mediaTypes: ['images']`, solo permisos foreground.
  > - `CameraView` sin hijos: los controles van como hermanos con posición absoluta.
  > - Toda suscripción (GPS, acelerómetro) se limpia al salir de la pantalla; ten en cuenta que en Tabs
  >   las pantallas no se desmontan al cambiar de pestaña.
  > - Permisos pedidos en contexto, nunca al abrir la app; sin ubicación la cámara sigue funcionando y la app
  >   lo comunica; "Abrir Ajustes" cuando el permiso está bloqueado.
  > - Hooks tipados, sin `any`, y los errores llegan a la UI como estado.
  > - Estilos con `StyleSheet` (el proyecto no usa NativeWind). Alias `@/` para imports.
  > - No agregues nada que el taller no pida (los retos opcionales quedan fuera).
  >
  > Entrega los archivos completos y una lista de pruebas para hacer en el teléfono.

- Prompt de verificación (segunda iteración):

  > Encárgate de probar la aplicación para que su integridad y sus funciones principales se ejecuten
  > correctamente, buscando que sea óptima y rápida. Si ves código redundante o irrelevante, revísalo,
  > corrígelo y optimízalo mientras pruebas. Cuando esté listo, despliega el proyecto para una validación manual.

## 2. Código Generado vs. Código Modificado

- **¿Qué generó la IA?:** Los tipos, los tres hooks (`useGeoLocation`, `useCamera`, `useShake`), el contexto
  `GeoPhotosContext`, `PermissionPrimer`, las pestañas GeoCam y Mapa, y el componente `ShakeToClear`.
- **Ajustes que la IA hizo sobre el código de la guía (revisar):**
  - Estilos pasados de `className` (NativeWind) a `StyleSheet`, porque el proyecto no tiene NativeWind.
  - En Tabs la pantalla GeoCam no se desmonta al cambiar de pestaña, así que el cleanup del GPS nunca corría.
    Se usa `useIsFocused()` para que el seguimiento, la cámara y el acelerómetro solo estén activos con la
    pestaña visible.
  - `useGeoLocation` y `useCamera` vuelven a consultar el permiso cuando la app regresa de Ajustes
    (`AppState` → `active`). Sin esto, el estado se quedaba en `blocked` aunque el usuario lo activara.
  - `useCamera` usa una `ref` como guarda de captura (el `state` no se actualiza a tiempo en un doble toque)
    y expone `error` como estado.
- **Correcciones durante la verificación (typecheck, lint, bundle y 35 pruebas con jest-expo):**
  - El proyecto se creó con la plantilla del SDK 57: rutas en `src/app`, pestañas nativas (`NativeTabs`) con
    íconos del sistema (`sf` en iOS, `md` en Android) en lugar de `@expo/vector-icons`, que ya no viene instalado.
  - El lint del React Compiler marcó 8 errores "Cannot access refs during render" en GeoCam: el objeto que
    devuelve `useCamera` incluye `cameraRef`, así que leer `cam.algo` en el render cuenta como leer un ref.
    Se corrigió desestructurando el hook.
  - Advertencia de dependencias en el `useEffect` que centra el mapa: se usa `[center]`.
  - Márgenes fijos de 56 px reemplazados por `useSafeAreaInsets()` (las pestañas nativas no tienen encabezado).
  - Se eliminaron los componentes, pantallas, estilos e imágenes de ejemplo de la plantilla que la app no usa.
  - Pruebas de mutación: al quitar la bandera `cancelled`, la guarda con `ref` o el enfriamiento del agitado,
    fallan 6 pruebas; con el código correcto pasan las 35.
- **¿Qué modifiqué/corregí?:** el mapa negro en Android con Expo Go. El rodeo inicial
  (teselas de OpenStreetMap con `mapType="none"`) no funcionaba; la causa real está en el
  descargador de teselas de `react-native-maps` y se corrige declarando `maximumNativeZ` en el
  `<UrlTile>`. Detalle y evidencia en la sección 3.

## 3. Alucinaciones o Errores Detectados

- El `useShake` del material de estudio generado por IA no cumplía el taller: no verificaba
  `isAvailableAsync()`, no usaba la bandera `cancelled` y tenía `onShake` en las dependencias del `useEffect`,
  así que se volvía a suscribir al acelerómetro en cada render si el callback no estaba memorizado.
  Se reescribió guardando el callback en una `ref`.
- El ejemplo de mapa del mismo material usaba `provider={PROVIDER_GOOGLE}`; para este taller en Expo Go
  no hace falta y se dejó el proveedor por defecto.
- La IA importó `useIsFocused` desde `@react-navigation/native`, que no es dependencia del proyecto en el SDK 57.
  El hook se exporta desde `expo-router`; se cambió el import.
- La IA escribió `import { Tabs } from 'expo-router'`: en el SDK 57 esa exportación está marcada como obsoleta
  (`@deprecated Use import { Tabs } from 'expo-router/js-tabs'`). Se reemplazó por las pestañas nativas de la plantilla.
- La IA asumió que el proyecto tendría `@expo/vector-icons` para los íconos de las pestañas; la plantilla
  del SDK 57 ya no lo incluye.
- Con TypeScript 6 las definiciones de Jest no se cargan solas (`types` ahora es `[]` por defecto);
  se agregó `"types": ["jest"]` al `tsconfig.json`.
- **Mapa negro en Expo Go con Android (SDK 57).** Es un bug de Expo, no del taller: el SDK de
  Maps de Google no descarga ninguna tesela dentro de Expo Go y el mapa queda completamente negro
  sin lanzar errores ([expo/expo#49323][1], abierto y sin resolver). En iOS no pasa.
  El primer intento de rodeo fue poner teselas de OpenStreetMap con `<UrlTile>` y `mapType="none"`,
  y **seguía en negro**. La causa está en el código nativo de `react-native-maps`
  (`MapTileProvider.getTile`):

  ```java
  if (!this.customMode) return this.tileProvider.getTile(x, y, zoom);
  ```

  `customMode` solo se activa desde `setMaximumNativeZ`, `setDoubleTileSize` o `setTileCachePath`,
  y como el *delegate* de Fabric (`RNMapsUrlTileManagerDelegate`) únicamente llama al setter de
  las props que vienen declaradas en el JS, el `defaultInt = 100` no cuenta. Sin esa prop, las
  teselas se piden por el `UrlTileProvider` **de Google**, que exige la API key del SDK de Maps,
  devuelve `null` dentro de Expo Go y el mapa queda negro. Al declarar `maximumNativeZ={19}`
  se enciende el descargador propio de la librería (un `HttpURLConnection` normal) y las teselas
  ya cargan sin necesitar ninguna key.

[1]: https://github.com/expo/expo/issues/49323
