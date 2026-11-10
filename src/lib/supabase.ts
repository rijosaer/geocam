import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { secureStorage } from '@/lib/secureStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env');
}

// Semana 10: el transporte del chat llama a las Edge Functions con fetch propio y necesita
// la URL y la publishable key (la publishable SÍ puede ir en la app: RLS protege los datos)
export const SUPABASE_URL = url;
export const SUPABASE_PUBLISHABLE_KEY = key;

export const supabase = createClient(url, key, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // no hay URL de navegador en una app nativa
  },
});

// El token solo se refresca mientras la app está en primer plano
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
