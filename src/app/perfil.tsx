import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { profileRepo } from '@/db/repositories/profile';
import { NIVELES, PERFIL_POR_DEFECTO, TEMAS, type PerfilTutor } from '@/constants/tutor';

// C2: perfil del estudiante. El Tutor lo envía en cada mensaje y el servidor arma las
// instrucciones con él (validado con zod: un valor inventado se reemplaza por el de por defecto).
export default function ProfileScreen() {
  const { session } = useAuth();
  const ownerId = session?.user.id ?? '';
  const [perfil, setPerfil] = useState<PerfilTutor | null>(null);

  useEffect(() => {
    if (!ownerId) return;
    profileRepo
      .get(ownerId)
      .then(setPerfil)
      .catch(() => setPerfil(PERFIL_POR_DEFECTO));
  }, [ownerId]);

  if (!perfil) return null;

  const save = async () => {
    await profileRepo.save(ownerId, perfil);
    router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.label}>¿Cómo te llamas?</Text>
      <TextInput
        style={styles.input}
        value={perfil.nombre}
        onChangeText={(nombre) => setPerfil({ ...perfil, nombre })}
        placeholder="Tu nombre"
        placeholderTextColor="#9ca3af"
        maxLength={40}
      />

      <Text style={styles.label}>¿En qué tema te estás enfocando?</Text>
      <View style={styles.chips}>
        {TEMAS.map((t) => (
          <Chip
            key={t.id}
            label={t.label}
            active={perfil.tema === t.id}
            onPress={() => setPerfil({ ...perfil, tema: t.id })}
          />
        ))}
      </View>

      <Text style={styles.label}>Nivel</Text>
      <View style={styles.chips}>
        {NIVELES.map((n) => (
          <Chip
            key={n.id}
            label={n.label}
            active={perfil.nivel === n.id}
            onPress={() => setPerfil({ ...perfil, nivel: n.id })}
          />
        ))}
      </View>

      <Text style={styles.note}>
        Se guarda solo en este teléfono. Se envía al servidor con cada pregunta para adaptar las
        respuestas del tutor.
      </Text>

      <Pressable onPress={() => void save()} style={styles.button}>
        <Text style={styles.buttonText}>Guardar</Text>
      </Pressable>
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, gap: 10 },
  label: { fontWeight: '700', color: '#171717', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#171717',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  chipText: { color: '#525252', fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  note: { color: '#737373', fontSize: 12, marginTop: 8 },
  button: {
    marginTop: 8,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#171717',
    paddingVertical: 12,
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});
