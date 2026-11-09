import { Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useSync } from '@/hooks/useSync';

// Indicador del estado de sincronización (T6): sin conexión, N pendientes,
// sincronizando o al día. Al tocarlo se abre la pantalla de estado (C4).
export function SyncBadge({ dark = false }: { dark?: boolean }) {
  const sync = useSync();

  let icon = '✓';
  let color = '#10b981';
  let label = 'Al día';

  if (!sync.isOnline) {
    icon = '⚠';
    color = '#d97706';
    label = sync.pendingCount > 0 ? `Sin conexión · ${sync.pendingCount} pendientes` : 'Sin conexión';
  } else if (sync.isSyncing) {
    icon = '↻';
    color = '#0284c7';
    label = 'Sincronizando…';
  } else if (sync.error) {
    icon = '!';
    color = '#dc2626';
    label = 'Error al sincronizar';
  } else if (sync.pendingCount > 0) {
    icon = '↑';
    color = '#d97706';
    label = `${sync.pendingCount} pendientes`;
  }

  return (
    <Pressable
      onPress={() => router.push('/sincronizacion')}
      style={[styles.badge, dark ? styles.badgeDark : styles.badgeLight]}
      accessibilityRole="button"
      accessibilityLabel={`Estado de sincronización: ${label}. Toca para ver el detalle`}
    >
      <Text style={[styles.icon, { color }]}>{icon}</Text>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeDark: { backgroundColor: 'rgba(0, 0, 0, 0.65)' },
  badgeLight: { backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e5e5e5' },
  icon: { fontSize: 13, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '600' },
});
