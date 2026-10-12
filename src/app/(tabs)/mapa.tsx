import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Pressable, FlatList, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useIsFocused } from 'expo-router';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { usePhotos } from '@/hooks/usePhotos';
import { ShakeToClear } from '@/components/ShakeToClear';
import { SOURCE_COLOR, SOURCE_LABEL } from '@/constants/colors';
import type { Coords, GeoPhoto } from '@/types/geo';

type LocatedPhoto = GeoPhoto & { coords: Coords };

// Mapa con Leaflet + OpenStreetMap en un WebView: no depende de Google Maps,
// que en Expo Go sobre Android se veía negro
const MAP_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;height:100%}</style></head><body><div id="map"></div><script>
var map = L.map('map').setView([4.711, -74.072], 11);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
var markers = L.layerGroup().addTo(map);
window.setMarkers = function (list) {
  markers.clearLayers();
  list.forEach(function (p) {
    L.circleMarker([p.lat, p.lng], { radius: 11, color: '#fff', weight: 3, fillColor: p.color, fillOpacity: 1 })
      .on('click', function () { window.ReactNativeWebView.postMessage(p.id); })
      .addTo(markers);
  });
};
window.centerOn = function (lat, lng) { map.setView([lat, lng], 16); };
</script></body></html>`;

export default function MapaScreen() {
  const isFocused = useIsFocused();
  const geo = useGeoLocation();
  const { photos, photosWithLocation, removePhoto } = usePhotos();
  const webRef = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const located = photosWithLocation.filter((p): p is LocatedPhoto => p.coords !== null);
  const withoutLocation = photos.filter((p) => p.coords === null);
  const selected = located.find((p) => p.id === selectedId) ?? null;

  // Lectura única al entrar a la pestaña (sin suscripción continua)
  const { permission, getCurrent } = geo;
  useEffect(() => {
    if (isFocused && permission === 'granted') getCurrent();
  }, [isFocused, permission, getCurrent]);

  // Centro: mi ubicación; sin permiso, la última foto con coordenadas (photos[0] es la más reciente)
  const center = (permission === 'granted' ? geo.coords : null) ?? located[0]?.coords ?? null;

  const markersJson = JSON.stringify(
    located.map((p) => ({
      id: p.id,
      lat: p.coords.latitude,
      lng: p.coords.longitude,
      color: SOURCE_COLOR[p.source],
    }))
  );

  useEffect(() => {
    if (loaded) webRef.current?.injectJavaScript(`window.setMarkers(${markersJson}); true;`);
  }, [loaded, markersJson]);

  useEffect(() => {
    if (loaded && center) {
      webRef.current?.injectJavaScript(
        `window.centerOn(${center.latitude}, ${center.longitude}); true;`
      );
    }
  }, [loaded, center]);

  const handleRemove = (id: string) => {
    if (id === selectedId) setSelectedId(null);
    removePhoto(id);
  };

  return (
    <View style={styles.screen}>
      {isFocused && <ShakeToClear />}

      <View style={styles.mapWrap}>
        <WebView
          ref={webRef}
          source={{ html: MAP_HTML }}
          originWhitelist={['*']}
          onLoadEnd={() => setLoaded(true)}
          onMessage={(e) => setSelectedId(e.nativeEvent.data)}
          style={StyleSheet.absoluteFill}
        />

        {selected && (
          <View style={styles.card}>
            <Image
              source={{ uri: selected.uri }}
              style={[styles.cardImage, { borderColor: SOURCE_COLOR[selected.source] }]}
            />
            <View style={styles.cardInfo}>
              <Text style={[styles.cardSource, { color: SOURCE_COLOR[selected.source] }]}>
                {SOURCE_LABEL[selected.source]}
              </Text>
              <Text style={styles.cardText}>
                {selected.coords.latitude.toFixed(5)}, {selected.coords.longitude.toFixed(5)}
              </Text>
              <Text style={styles.cardText}>{new Date(selected.createdAt).toLocaleString()}</Text>
              <View style={styles.cardActions}>
                <Pressable onPress={() => handleRemove(selected.id)}>
                  <Text style={styles.remove}>Eliminar</Text>
                </Pressable>
                <Pressable onPress={() => setSelectedId(null)}>
                  <Text style={styles.close}>Cerrar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {photos.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Aún no hay fotos. Toma una en la pestaña GeoCam.</Text>
          </View>
        )}
      </View>

      {withoutLocation.length > 0 && (
        <View style={styles.noLocation}>
          <Text style={styles.noLocationTitle}>Sin ubicación ({withoutLocation.length})</Text>
          <FlatList
            horizontal
            data={withoutLocation}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.noLocationList}
            renderItem={({ item }) => (
              <Pressable onLongPress={() => handleRemove(item.id)} style={styles.noLocationItem}>
                <Image
                  source={{ uri: item.uri }}
                  style={[styles.noLocationThumb, { borderColor: SOURCE_COLOR[item.source] }]}
                />
                <Text style={[styles.noLocationLabel, { color: SOURCE_COLOR[item.source] }]}>
                  {SOURCE_LABEL[item.source]}
                </Text>
              </Pressable>
            )}
          />
          <Text style={styles.hint}>Mantén presionada una foto para eliminarla.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  mapWrap: { flex: 1 },
  card: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    gap: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  cardImage: { width: 88, height: 88, borderRadius: 8, borderWidth: 2 },
  cardInfo: { flex: 1, gap: 2 },
  cardSource: { fontWeight: '700' },
  cardText: { fontSize: 12, color: '#404040' },
  cardActions: { flexDirection: 'row', gap: 16, marginTop: 6 },
  remove: { color: '#dc2626', fontWeight: '600' },
  close: { color: '#525252', fontWeight: '600' },
  empty: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 12,
  },
  emptyText: { textAlign: 'center', color: '#404040' },
  noLocation: {
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    paddingVertical: 12,
    gap: 8,
  },
  noLocationTitle: { paddingHorizontal: 16, fontWeight: '700', color: '#171717' },
  noLocationList: { paddingHorizontal: 16, gap: 12 },
  noLocationItem: { alignItems: 'center', gap: 4 },
  noLocationThumb: { width: 64, height: 64, borderRadius: 8, borderWidth: 2 },
  noLocationLabel: { fontSize: 10, fontWeight: '700' },
  hint: { paddingHorizontal: 16, fontSize: 11, color: '#737373' },
});
