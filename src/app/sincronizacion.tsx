import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSync } from '@/hooks/useSync';

// Pantalla de estado de sincronización (C4): pendientes, última sincronización,
// cuántas subieron y bajaron, el último error y un botón para sincronizar ahora.
export default function SyncStatusScreen() {
  const sync = useSync();
  const last = sync.lastSync;
  const currentError = sync.error ? sync.error.message : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Row label="Conexión" value={sync.isOnline ? 'En línea' : 'Sin conexión'} />
        <Row
          label="Fotos pendientes"
          value={String(sync.pendingCount)}
          highlight={sync.pendingCount > 0}
        />
        <Row
          label="Estado"
          value={
            sync.isSyncing
              ? 'Sincronizando…'
              : !sync.isOnline
                ? 'En pausa hasta que vuelva la red'
                : sync.pendingCount > 0
                  ? 'Hay cambios por subir'
                  : 'Al día'
          }
        />
      </View>

      <Text style={styles.sectionTitle}>Última sincronización</Text>
      {last === null ? (
        <Text style={styles.muted}>Todavía no se ha sincronizado en este teléfono.</Text>
      ) : (
        <View style={styles.card}>
          <Row label="Fecha" value={new Date(last.finishedAt).toLocaleString('es-CO')} />
          <Row label="Resultado" value={last.ok ? 'Completa' : 'Interrumpida'} />
          <Row label="Bajaron" value={`${last.pulled} cambio(s)`} />
          <Row label="Subieron" value={`${last.pushed} foto(s)`} />
          {last.failed > 0 && (
            <Row label="Fallaron" value={`${last.failed} (siguen pendientes)`} highlight />
          )}
        </View>
      )}

      {(currentError ?? last?.lastError) && (
        <>
          <Text style={styles.sectionTitle}>Último error</Text>
          <Text style={styles.error}>{currentError ?? last?.lastError}</Text>
        </>
      )}

      <Pressable
        onPress={sync.syncNow}
        disabled={!sync.isOnline || sync.isSyncing}
        style={[styles.button, (!sync.isOnline || sync.isSyncing) && styles.buttonDisabled]}
        accessibilityRole="button"
      >
        {sync.isSyncing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sincronizar ahora</Text>
        )}
      </Pressable>
      {!sync.isOnline && (
        <Text style={styles.muted}>
          Sin conexión todo sigue funcionando en el teléfono. Al volver la red se sincroniza solo.
        </Text>
      )}
    </ScrollView>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowValueHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    backgroundColor: '#fafafa',
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  rowLabel: { color: '#525252', fontSize: 14 },
  rowValue: { color: '#171717', fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  rowValueHighlight: { color: '#d97706' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#737373', marginTop: 8 },
  muted: { color: '#737373', fontSize: 13 },
  error: { color: '#dc2626', fontSize: 13 },
  button: {
    marginTop: 8,
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#a3a3a3' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
