import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (action: typeof signIn) => {
    if (!email.trim() || password.length < 6) {
      setMessage('Escribe tu correo y una contraseña de al menos 6 caracteres.');
      return;
    }
    setBusy(true);
    setInfo(null);
    const result = await action(email, password);
    // signUp devuelve un aviso informativo cuando pide confirmar el correo
    if (result !== null && result.startsWith('Revisa tu correo')) {
      setMessage(null);
      setInfo(result);
    } else {
      setMessage(result);
    }
    setBusy(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GeoCam</Text>
      <Text style={styles.subtitle}>Tu cámara con ubicación, ahora en la nube</Text>

      <TextInput
        style={styles.input}
        placeholder="Correo"
        placeholderTextColor="#9ca3af"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor="#9ca3af"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {message !== null && <Text style={styles.message}>{message}</Text>}
      {info !== null && <Text style={styles.info}>{info}</Text>}

      <Pressable style={styles.button} disabled={busy} onPress={() => submit(signIn)}>
        <Text style={styles.buttonText}>{busy ? 'Un momento…' : 'Iniciar sesión'}</Text>
      </Pressable>
      <Pressable style={styles.link} disabled={busy} onPress={() => submit(signUp)}>
        <Text style={styles.linkText}>Crear cuenta</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: { fontSize: 32, fontWeight: '800', color: '#171717', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#737373', textAlign: 'center', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#171717',
  },
  message: { color: '#dc2626', fontSize: 13 },
  info: { color: '#047857', fontSize: 13 },
  button: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { alignItems: 'center', padding: 8 },
  linkText: { color: '#047857', fontWeight: '600' },
});
