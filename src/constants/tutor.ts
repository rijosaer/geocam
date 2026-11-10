// Opciones del perfil del Tutor IA (C2). Deben coincidir con supabase/functions/_shared/perfil.ts:
// si la app enviara otro valor, el servidor lo reemplaza por el de por defecto.
export const TEMAS = [
  { id: 'general', label: 'General' },
  { id: 'react-native', label: 'React Native' },
  { id: 'expo-router', label: 'Expo Router' },
  { id: 'sqlite-drizzle', label: 'SQLite y Drizzle' },
  { id: 'supabase', label: 'Supabase' },
  { id: 'tanstack-query', label: 'TanStack Query' },
  { id: 'ia', label: 'IA en apps' },
] as const;

export const NIVELES = [
  { id: 'basico', label: 'Básico' },
  { id: 'intermedio', label: 'Intermedio' },
  { id: 'avanzado', label: 'Avanzado' },
] as const;

export type TemaId = (typeof TEMAS)[number]['id'];
export type NivelId = (typeof NIVELES)[number]['id'];

export interface PerfilTutor {
  nombre: string;
  tema: TemaId;
  nivel: NivelId;
}

export const PERFIL_POR_DEFECTO: PerfilTutor = { nombre: '', tema: 'general', nivel: 'basico' };
