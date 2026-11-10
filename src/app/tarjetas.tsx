import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { chatRepo } from '@/db/repositories/chat';
import { useIsOnline } from '@/lib/queryClient';
import { invocarFuncion } from '@/services/ia';

interface Tarjeta {
  pregunta: string;
  respuesta: string;
}

async function generarTarjetas(ownerId: string): Promise<Tarjeta[]> {
  const id = await chatRepo.currentConversation(ownerId);
  const mensajes = (await chatRepo.load(ownerId, id))
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      rol: m.role,
      // Solo el texto: las fotos no hacen falta para repasar
      texto: m.parts
        .flatMap((p) => (p.type === 'text' ? [p.text] : []))
        .join('\n')
        .slice(0, 8000),
    }))
    .filter((m) => m.texto.trim() !== '')
    .slice(-40);
  const res = await invocarFuncion<{ tarjetas: Tarjeta[] }>('tarjetas', { mensajes });
  return res.tarjetas;
}

// C3: tarjetas de repaso generadas a partir de la conversación actual con el tutor.
// La función "tarjetas" responde JSON validado con zod (Output.object), de 3 a 5 tarjetas.
export default function FlashcardsScreen() {
  const { session } = useAuth();
  const ownerId = session?.user.id ?? '';
  const isOnline = useIsOnline();

  // Una consulta de TanStack Query: sin red queda en pausa, y no se reintenta sola para no
  // gastar la cuota de IA (el usuario decide con "Reintentar" o "Generar otras")
  const query = useQuery({
    queryKey: ['tarjetas', ownerId],
    queryFn: () => generarTarjetas(ownerId),
    enabled: ownerId !== '',
    retry: false,
    staleTime: Infinity,
    gcTime: 0, // al salir de la pantalla se descartan: la próxima vez se generan de nuevo
  });
  const tarjetas = query.data ?? null;
  const loading = query.isFetching;
  const error = query.error ? query.error.message : null;
  const generar = () => query.refetch();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!isOnline && <Text style={styles.offline}>Sin conexión: las tarjetas se generan con IA.</Text>}
      {loading && (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Leyendo tu conversación…</Text>
        </View>
      )}
      {error !== null && (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          {isOnline && (
            <Pressable onPress={() => void generar()} style={styles.button}>
              <Text style={styles.buttonText}>Reintentar</Text>
            </Pressable>
          )}
        </View>
      )}
      {tarjetas?.map((t, i) => <Card key={i} index={i + 1} tarjeta={t} />)}
      {tarjetas !== null && !loading && (
        <Pressable onPress={() => void generar()} style={styles.button} disabled={!isOnline}>
          <Text style={styles.buttonText}>Generar otras</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

// Toca la tarjeta para ver la respuesta
function Card({ index, tarjeta }: { index: number; tarjeta: Tarjeta }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((o) => !o)} style={[styles.card, open && styles.cardOpen]}>
      <Text style={styles.cardIndex}>Tarjeta {index}</Text>
      <Text style={styles.question}>{tarjeta.pregunta}</Text>
      {open ? (
        <Text style={styles.answer}>{tarjeta.respuesta}</Text>
      ) : (
        <Text style={styles.muted}>Toca para ver la respuesta</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f6f8f7' },
  content: { padding: 16, gap: 12 },
  offline: { backgroundColor: '#fef3c7', color: '#92400e', padding: 10, borderRadius: 8 },
  center: { alignItems: 'center', gap: 10, padding: 24 },
  muted: { color: '#737373', fontSize: 13 },
  error: { color: '#dc2626', textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 16,
    gap: 8,
  },
  cardOpen: { borderColor: '#10b981' },
  cardIndex: { color: '#059669', fontWeight: '700', fontSize: 12 },
  question: { fontSize: 16, fontWeight: '600', color: '#171717' },
  answer: { fontSize: 15, color: '#404040', lineHeight: 21 },
  button: {
    alignSelf: 'center',
    borderRadius: 10,
    backgroundColor: '#171717',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
