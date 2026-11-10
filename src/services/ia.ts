// Única puerta de la app hacia las Edge Functions de IA (Semana 10).
// La app NUNCA habla con Gemini: llama a funciones de Supabase con el token de sesión.
// Aquí también se traducen los errores a mensajes claros (C4).
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type IAErrorKind =
  | 'sin_red' // no se pudo hablar con el servidor
  | 'sesion' // 401: token vencido o inválido
  | 'limite_diario' // 429 de nuestro límite por usuario (C5)
  | 'cuota_gemini' // 429 de la capa gratuita de Gemini
  | 'entrada' // 400: la petición no tenía lo necesario
  | 'servidor'; // cualquier otra falla

export class IAError extends Error {
  constructor(
    public readonly kind: IAErrorKind,
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'IAError';
  }
}

const MENSAJES: Record<IAErrorKind, string> = {
  sin_red: 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.',
  sesion: 'Tu sesión venció. Vuelve a iniciar sesión.',
  limite_diario: 'Llegaste a tu límite diario de consultas de IA. Vuelve mañana.',
  cuota_gemini: 'Se agotó la cuota gratuita de Gemini. Espera un minuto e intenta de nuevo.',
  entrada: 'La petición no tenía lo necesario.',
  servidor: 'La IA no pudo responder. Intenta de nuevo.',
};

/** Convierte una respuesta HTTP fallida de una Edge Function en un IAError con mensaje claro. */
export async function errorDeRespuesta(res: Response): Promise<IAError> {
  // Las funciones responden { error, mensaje }; la plataforma (401) responde { code, message }
  let codigo: string | undefined;
  let mensaje: string | undefined;
  try {
    const body = (await res.json()) as { error?: string; mensaje?: string };
    codigo = body.error;
    mensaje = body.mensaje;
  } catch {
    // Cuerpo vacío o que no es JSON: se usa el mensaje por estado
  }

  let kind: IAErrorKind;
  if (res.status === 401) kind = 'sesion';
  else if (res.status === 429) kind = codigo === 'limite_diario' ? 'limite_diario' : 'cuota_gemini';
  else if (res.status === 400) kind = 'entrada';
  else kind = 'servidor';

  // En 401 el texto de la plataforma está en inglés: se usa el nuestro
  const texto = kind === 'sesion' || !mensaje ? MENSAJES[kind] : mensaje;
  return new IAError(kind, texto, res.status);
}

export function errorDeRed(): IAError {
  return new IAError('sin_red', MENSAJES.sin_red);
}

/** C4: si el token venció, se cierra la sesión y la app vuelve al login. */
export async function cerrarSesionSiVencio(error: unknown): Promise<void> {
  if (error instanceof IAError && error.kind === 'sesion') {
    await supabase.auth.signOut().catch(() => undefined);
  }
}

/**
 * Llama una Edge Function que responde una sola vez (sin streaming).
 * supabase.functions.invoke envía el token de sesión automáticamente.
 */
export async function invocarFuncion<T>(nombre: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(nombre, { body });
  if (!error) {
    if (data === null) throw new IAError('servidor', MENSAJES.servidor);
    return data;
  }
  let iaError: IAError;
  if (error instanceof FunctionsHttpError) {
    // Respuesta 4xx o 5xx de la función: el mensaje está en error.context
    iaError = await errorDeRespuesta(error.context as Response);
  } else if (error instanceof FunctionsFetchError) {
    iaError = errorDeRed();
  } else if (error instanceof FunctionsRelayError) {
    iaError = new IAError('servidor', MENSAJES.servidor);
  } else {
    iaError = new IAError('servidor', MENSAJES.servidor);
  }
  await cerrarSesionSiVencio(iaError);
  throw iaError;
}
