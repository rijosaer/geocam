import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useIsOnline } from '@/lib/queryClient';
import { describirFoto } from '@/services/vision';

interface Props {
  uri: string; // archivo local de la foto
  initial: string; // descripción guardada (vacía si no tiene)
  onSave: (text: string) => Promise<boolean>;
}

// "GeoCam ve" (T4 y T6): la IA sugiere una descripción y el usuario la revisa antes de guardarla.
// Guardar funciona sin red (queda pendiente y sube con la sincronización); describir no.
export function AiDescription({ uri, initial, onSave }: Props) {
  const isOnline = useIsOnline();
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [suggested, setSuggested] = useState(false); // el texto viene de la IA y no se ha guardado
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const describe = async () => {
    setLoading(true);
    setError(null);
    try {
      const text = await describirFoto(uri);
      setDraft(text);
      setSuggested(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (await onSave(draft)) {
      setSaved(draft.trim());
      setSuggested(false);
    }
  };

  const dirty = draft.trim() !== saved.trim();

  return (
    <View style={styles.box}>
      <Text style={styles.privacy}>
        🔒 Al tocar «Describir con IA», una copia reducida de la foto se envía a Google Gemini, a
        través del servidor de GeoCam, para generar el texto. La descripción se guarda en tu
        teléfono y se sincroniza con tu nube como la nota.
      </Text>

      <Pressable
        onPress={() => void describe()}
        disabled={!isOnline || loading}
        style={[styles.aiButton, (!isOnline || loading) && styles.aiButtonOff]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.aiButtonText}>✨ Describir con IA</Text>
        )}
      </Pressable>
      {!isOnline && (
        <Text style={styles.offline}>
          Sin conexión: describir con IA necesita internet. Puedes escribir la descripción a mano.
        </Text>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}

      {suggested && (
        <Text style={styles.suggestion}>
          Sugerencia de la IA: puede equivocarse. Revísala, corrígela y guárdala.
        </Text>
      )}
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Sin descripción"
        placeholderTextColor="#9ca3af"
        multiline
        style={[styles.input, suggested && styles.inputSuggested]}
      />
      <Pressable
        onPress={() => void save()}
        disabled={!dirty}
        style={[styles.saveButton, !dirty && styles.saveButtonOff]}
      >
        <Text style={styles.saveButtonText}>Guardar descripción</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  privacy: {
    fontSize: 12,
    color: '#525252',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    lineHeight: 17,
  },
  aiButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#7c3aed',
  },
  aiButtonOff: { backgroundColor: '#c4b5fd' },
  aiButtonText: { color: '#fff', fontWeight: '700' },
  offline: { fontSize: 12, color: '#92400e' },
  error: { fontSize: 13, color: '#dc2626' },
  suggestion: { fontSize: 12, color: '#6d28d9', fontWeight: '600' },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#171717',
    textAlignVertical: 'top',
  },
  inputSuggested: { borderColor: '#a78bfa', backgroundColor: '#faf5ff' },
  saveButton: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: '#171717',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  saveButtonOff: { backgroundColor: '#a3a3a3' },
  saveButtonText: { color: '#fff', fontWeight: '700' },
});
