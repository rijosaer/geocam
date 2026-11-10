import { useChat } from '@ai-sdk/react';
import type { FileUIPart, UIMessage } from 'ai';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { ChatBubble } from '@/components/ChatBubble';
import { useAuth } from '@/context/AuthContext';
import { chatRepo } from '@/db/repositories/chat';
import { profileRepo } from '@/db/repositories/profile';
import { crearTransporte } from '@/lib/chatTransport';
import { useIsOnline } from '@/lib/queryClient';
import { cerrarSesionSiVencio, IAError } from '@/services/ia';
import { elegirFotoParaChat } from '@/services/vision';

// Tutor IA dentro de GeoCam. C1: el historial vive en SQLite; al abrir sigue donde iba.
export default function TutorScreen() {
  const { session } = useAuth();
  const ownerId = session?.user.id ?? '';
  const [chat, setChat] = useState<{ id: string; initial: UIMessage[] } | null>(null);

  useEffect(() => {
    if (!ownerId) return;
    let alive = true;
    (async () => {
      const id = await chatRepo.currentConversation(ownerId);
      const initial = await chatRepo.load(ownerId, id);
      if (alive) setChat({ id, initial });
    })().catch((e) => console.warn('No se pudo cargar el historial', e));
    return () => {
      alive = false;
    };
  }, [ownerId]);

  const newConversation = async () => {
    const id = await chatRepo.newConversation(ownerId);
    setChat({ id, initial: [] });
  };

  if (!chat) return <ActivityIndicator style={{ flex: 1 }} />;

  // key: al cambiar de conversación, useChat arranca de cero con su propio historial
  return (
    <Conversation
      key={chat.id}
      ownerId={ownerId}
      conversationId={chat.id}
      initial={chat.initial}
      onNew={newConversation}
    />
  );
}

interface ConversationProps {
  ownerId: string;
  conversationId: string;
  initial: UIMessage[];
  onNew: () => void;
}

function Conversation({ ownerId, conversationId, initial, onNew }: ConversationProps) {
  const isOnline = useIsOnline();
  // C2: el perfil se lee de SQLite en cada mensaje, así siempre va el más reciente
  const { data: profileRows } = useLiveQuery(profileRepo.byOwnerQuery(ownerId), [ownerId]);
  const perfil = profileRepo.toPerfil(profileRows[0]); // para el saludo
  const transport = useMemo(() => crearTransporte(() => profileRepo.get(ownerId)), [ownerId]);
  const { messages, sendMessage, status, error, stop, regenerate, clearError } = useChat({
    id: conversationId,
    messages: initial,
    transport,
    // C1: al terminar (bien, con error o detenida) se guarda la conversación completa
    onFinish: ({ messages: all }) => {
      chatRepo
        .save(ownerId, conversationId, all)
        .catch((e) => console.warn('No se pudo guardar el historial', e));
    },
  });

  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<FileUIPart | null>(null);
  const list = useRef<FlatList<UIMessage>>(null);

  const busy = status === 'submitted' || status === 'streaming';
  const iaError = error instanceof IAError ? error : null;

  // C4: si el token venció, se cierra la sesión (la app vuelve al login)
  useEffect(() => {
    if (error) void cerrarSesionSiVencio(error);
  }, [error]);

  const canSend = isOnline && !busy && (text.trim() !== '' || photo !== null);

  function send() {
    if (!canSend) return;
    void sendMessage({
      text: text.trim() || '¿Qué ves en esta foto?',
      files: photo ? [photo] : undefined,
    });
    setText('');
    setPhoto(null);
  }

  async function attach(origen: 'camara' | 'galeria') {
    try {
      const f = await elegirFotoParaChat(origen);
      if (f) setPhoto(f);
    } catch (e) {
      Alert.alert('Foto', e instanceof Error ? e.message : String(e));
    }
  }

  // Reintentar no tiene sentido sin red ni cuando se acabó el cupo del día
  const canRetry = isOnline && iaError?.kind !== 'limite_diario' && iaError?.kind !== 'sesion';

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.toolbar}>
        <Pressable onPress={onNew} disabled={busy} style={styles.toolButton}>
          <Text style={styles.toolText}>＋ Nueva conversación</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/perfil')} style={styles.toolButton}>
          <Text style={styles.toolText}>👤 Perfil</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/tarjetas')}
          disabled={busy || messages.length < 2}
          style={[styles.toolButton, (busy || messages.length < 2) && styles.disabled]}
        >
          <Text style={styles.toolText}>🃏 Repaso</Text>
        </Pressable>
      </View>

      {/* C4: banner sin conexión */}
      {!isOnline && (
        <Text style={styles.offline}>
          Sin conexión. Puedes leer tu historial; para preguntar necesitas internet.
        </Text>
      )}

      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <ChatBubble message={item} />}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {perfil.nombre ? `Hola, ${perfil.nombre}. ` : ''}Pregúntame lo que quieras de
            programación móvil. También puedes enviarme una foto (por ejemplo, código en papel).
          </Text>
        }
      />

      {status === 'submitted' && <ActivityIndicator style={styles.waiting} />}

      {/* C4: mensajes claros para 401, 429 y falla de red, con Reintentar */}
      {error && (
        <View style={styles.error}>
          <Text style={styles.errorText}>{error.message}</Text>
          <View style={styles.errorActions}>
            {canRetry && (
              <Pressable onPress={() => void regenerate()} style={styles.retry}>
                <Text style={styles.retryText}>Reintentar</Text>
              </Pressable>
            )}
            <Pressable onPress={clearError}>
              <Text style={styles.errorLink}>Cerrar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {photo && (
        <View style={styles.preview}>
          <Image source={{ uri: photo.url }} style={styles.thumb} />
          <Text style={styles.previewText}>Foto lista. Se enviará a Google Gemini.</Text>
          <Pressable onPress={() => setPhoto(null)}>
            <Text style={styles.toolText}>Quitar</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.bar}>
        <Pressable style={styles.icon} onPress={() => void attach('camara')} disabled={busy}>
          <Text>📷</Text>
        </Pressable>
        <Pressable style={styles.icon} onPress={() => void attach('galeria')} disabled={busy}>
          <Text>🖼️</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder={isOnline ? 'Escribe tu pregunta' : 'Sin conexión'}
          placeholderTextColor="#9ca3af"
          value={text}
          onChangeText={setText}
          multiline
          editable={!busy}
        />
        {busy ? (
          <Pressable style={styles.send} onPress={() => void stop()}>
            <Text style={styles.sendText}>■</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.send, !canSend && styles.sendOff]} onPress={send} disabled={!canSend}>
            <Text style={styles.sendText}>➤</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f6f8f7' },
  toolbar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e5e5e5',
  },
  toolButton: { paddingHorizontal: 8, paddingVertical: 6 },
  toolText: { color: '#059669', fontWeight: '600' },
  disabled: { opacity: 0.4 },
  offline: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  list: { padding: 12, flexGrow: 1 },
  empty: { textAlign: 'center', color: '#737373', marginTop: 40, paddingHorizontal: 24 },
  waiting: { marginBottom: 8 },
  error: {
    backgroundColor: '#fee2e2',
    marginHorizontal: 12,
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    gap: 8,
  },
  errorText: { color: '#991b1b' },
  errorActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  retry: { backgroundColor: '#991b1b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  retryText: { color: '#fff', fontWeight: '600' },
  errorLink: { color: '#991b1b', fontWeight: '600' },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  thumb: { width: 48, height: 48, borderRadius: 8 },
  previewText: { flex: 1, color: '#525252' },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    padding: 8,
    borderTopWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
  },
  icon: { padding: 10 },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: '#f3f4f6',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#171717',
  },
  send: {
    backgroundColor: '#10b981',
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { backgroundColor: '#a7f3d0' },
  sendText: { color: '#fff', fontSize: 18 },
});
