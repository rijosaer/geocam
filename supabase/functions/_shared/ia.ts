// Piezas comunes de las Edge Functions de IA. La key de Gemini SOLO existe aquí, como secreto:
//   npx supabase secrets set GEMINI_API_KEY=TU_CLAVE
// Nunca en la app ni en el .env de Expo (todo EXPO_PUBLIC_* queda en el bundle).
import { createGoogleGenerativeAI } from 'npm:@ai-sdk/google@4';
import { APICallError, RetryError } from 'npm:ai@7';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const google = createGoogleGenerativeAI({ apiKey: Deno.env.get('GEMINI_API_KEY') });
export const MODELO = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite';

// C5: peticiones de IA permitidas por usuario cada 24 horas.
// Para probar sin gastar cuota: npx supabase secrets set LIMITE_DIARIO=3
const LIMITE_DIARIO = Number(Deno.env.get('LIMITE_DIARIO') ?? '20');

export type FuncionIA = 'tutor' | 'describir-foto' | 'tarjetas';

/** Respuesta JSON con un código que la app traduce a un mensaje claro (C4). */
export function jsonError(status: number, error: string, mensaje: string): Response {
  return Response.json({ error, mensaje }, { status });
}

/**
 * C5. Cuenta las peticiones del usuario en las últimas 24 horas y, si le queda cupo,
 * registra esta. Usa el cliente DEL USUARIO (ctx.supabase): RLS solo le deja ver e
 * insertar sus propias filas, así que no hace falta (ni conviene) la secret key.
 * Devuelve una Response 429 si ya no hay cupo, o null para continuar.
 */
export async function consumirCupo(
  supabase: SupabaseClient,
  funcion: FuncionIA
): Promise<Response | null> {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('uso_ia')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', desde);
  if (error) {
    console.error('No se pudo contar el uso de IA', error);
    return jsonError(500, 'uso_ia', 'No se pudo revisar tu límite diario. Intenta de nuevo.');
  }
  if ((count ?? 0) >= LIMITE_DIARIO) {
    return jsonError(
      429,
      'limite_diario',
      `Llegaste a tu límite de ${LIMITE_DIARIO} consultas de IA en 24 horas. Vuelve mañana.`
    );
  }
  const { error: insertError } = await supabase.from('uso_ia').insert({ funcion });
  if (insertError) {
    console.error('No se pudo registrar el uso de IA', insertError);
    return jsonError(500, 'uso_ia', 'No se pudo registrar tu consulta. Intenta de nuevo.');
  }
  return null;
}

/** ¿El error de Gemini es de cuota (429)? Tras los reintentos viene dentro de RetryError. */
export function esCuotaGemini(error: unknown): boolean {
  const real = RetryError.isInstance(error) ? error.lastError : error;
  return APICallError.isInstance(real) && real.statusCode === 429;
}

/** Convierte un error de Gemini en una respuesta para la app. Nunca el error crudo de Google. */
export function respuestaErrorGemini(error: unknown): Response {
  console.error(error);
  if (esCuotaGemini(error)) {
    return jsonError(429, 'cuota_gemini', 'Se agotó la cuota gratuita de Gemini. Espera un minuto.');
  }
  return jsonError(502, 'gemini', 'La IA no pudo responder. Intenta de nuevo.');
}
