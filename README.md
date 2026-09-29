# GeoCam – Taller Semana 6

Cámara que etiqueta cada foto con coordenadas GPS, mapa de fotos y borrado al agitar el teléfono.
Expo SDK 57 · Expo Router · TypeScript estricto · probado con Expo Go en un teléfono físico.

## Ejecutar

```bash
npm install
npx expo start            # misma red Wi-Fi que el teléfono
npx expo start --tunnel   # si el teléfono está en otra red
```

Escanea el QR con Expo Go (actualizado a la versión que soporta el SDK 57).

## Estructura

```
src/app/(tabs)/_layout.tsx       Pestañas nativas + GeoPhotosProvider
src/app/(tabs)/geocam.tsx        Cámara, banner de ubicación, importar de galería
src/app/(tabs)/mapa.tsx          Marcadores, miniatura al tocar, lista "Sin ubicación"
src/components/PermissionPrimer.tsx
src/components/ShakeToClear.tsx  Alert de borrado al agitar
src/hooks/useGeoLocation.ts      Permiso, lectura única y seguimiento de ubicación
src/hooks/useCamera.ts           Permiso, cámara frontal/trasera y captura
src/hooks/useShake.ts            Detección de agitado con el acelerómetro
src/context/GeoPhotosContext.tsx addPhoto, removePhoto, clearAll
src/types/geo.ts
src/__tests__/                   Pruebas de los hooks y del contexto
```

## Requisitos del taller

| Req. | Dónde |
|---|---|
| R1 Estado global de fotos | `src/context/GeoPhotosContext.tsx`, Provider en `src/app/(tabs)/_layout.tsx` |
| R2 Importar desde galería | Botón 🖼 en GeoCam; borde verde = cámara, ámbar = galería |
| R3 Pestaña Mapa | `src/app/(tabs)/mapa.tsx` |
| R4 useShake | `src/hooks/useShake.ts` + `src/components/ShakeToClear.tsx` |
| R5 AI-LOG | `AI-LOG.md` |

## Verificación automática

```bash
npx tsc --noEmit   # tipos
npx expo lint      # lint (incluye reglas del React Compiler)
npm test           # 35 pruebas de hooks y contexto
```

Las pruebas cubren: mapeo de los cinco estados de permiso, que al abrir solo se consulta el permiso,
limpieza del GPS y del acelerómetro al desmontar y al salir de la pestaña, la suscripción huérfana
(bandera `cancelled`), umbral y enfriamiento del agitado, guarda de doble toque de la cámara,
errores expuestos como estado, re-consulta del permiso al volver de Ajustes y actualizaciones inmutables del contexto.

## Estados de permiso

En Expo Go los permisos pertenecen a Expo Go: para repetir una prueba, quítalos en
*Ajustes → Apps → Expo Go → Permisos*.

| Concedido | Rechazado | Bloqueado |
|---|---|---|
| _(captura)_ | _(captura)_ | _(captura)_ |

## Pruebas en el teléfono

- [ ] La app no pide permisos al abrirse; la cámara se pide con "Permitir acceso".
- [ ] Negar la ubicación: la cámara sigue funcionando, aparece el banner y la foto se guarda en "Sin ubicación".
- [ ] Negar la cámara dos veces en Android: aparece "Abrir Ajustes"; al activarla en Ajustes y volver, se abre la cámara.
- [ ] Importar una foto de la galería: se ve con borde ámbar y etiqueta "Galería".
- [ ] En Mapa: un marcador por foto con coordenadas; al tocarlo se ve la miniatura.
- [ ] Sin permiso de ubicación, el mapa se centra en la última foto.
- [ ] Agitar el teléfono: aparece el Alert y "Borrar todo" vacía las fotos.
- [ ] Log temporal en los cleanups: al cambiar de pestaña se detienen el GPS y el acelerómetro.
