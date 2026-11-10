import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from '@/lib/supabase';
import { errorDeRed, errorDeRespuesta, IAError } from '@/services/ia';
import type { PerfilTutor } from '@/constants/tutor';

/**
 * Transporte de useChat hacia una Edge Function con streaming.
 * - headers: se calculan EN CADA mensaje, así siempre va el token vigente.
 * - body: el perfil (C2) también se lee en cada mensaje; el servidor lo valida con zod.
 * - fetch: el de Expo, que sí entrega la respuesta por partes. Se envuelve para convertir
 *   401, 429 y fallas de red en IAError con un mensaje claro (C4).
 */
export function crearTransporte(
  obtenerPerfil: () => Promise<PerfilTutor>,
  funcion = 'tutor'
) {
  const fetchConErrores = async (url: string, init?: RequestInit) => {
    let res: Response;
    try {
      res = (await expoFetch(url, init as Parameters<typeof expoFetch>[1])) as unknown as Response;
    } catch (e) {
      // El botón ■ aborta la petición: eso no es un error de red
      if (init?.signal?.aborted) throw e;
      throw errorDeRed();
    }
    if (!res.ok) throw await errorDeRespuesta(res);
    return res;
  };

  return new DefaultChatTransport({
    api: `${SUPABASE_URL}/functions/v1/${funcion}`,
    fetch: fetchConErrores as unknown as typeof globalThis.fetch,
    headers: async (): Promise<Record<string, string>> => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new IAError('sesion', 'No hay sesión: vuelve a iniciar sesión.');
      return { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY };
    },
    body: async () => ({ perfil: await obtenerPerfil() }),
  });
}
