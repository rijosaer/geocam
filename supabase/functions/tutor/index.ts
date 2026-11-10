// Edge Function "tutor": chat con streaming. Igual al ejemplo guiado, más:
//   C2: instrucciones armadas con el perfil validado con zod.
//   C5: límite de peticiones por usuario cada 24 horas.
// Despliegue: npx supabase functions deploy tutor
import { withSupabase } from 'npm:@supabase/server@1';
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'npm:ai@7';
import { consumirCupo, esCuotaGemini, google, jsonError, MODELO } from '../_shared/ia.ts';
import { instruccionesTutor, Perfil } from '../_shared/perfil.ts';

export default {
  // auth: 'user' => sin un token de sesión válido responde 401 y nunca llega a Gemini.
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return jsonError(405, 'metodo', 'Usa POST');

    const body = (await req.json().catch(() => null)) as {
      messages?: UIMessage[];
      perfil?: unknown;
    } | null;
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return jsonError(400, 'entrada', 'Falta la conversación.');
    }
    // C2: un perfil falso o un tema inventado no falla: .catch() lo deja en el valor por defecto
    const perfil = Perfil.parse(body.perfil);

    // C5: antes de gastar tokens, ¿le queda cupo hoy?
    const sinCupo = await consumirCupo(ctx.supabase, 'tutor');
    if (sinCupo) return sinCupo;

    const result = streamText({
      model: google(MODELO),
      instructions: instruccionesTutor(perfil, ctx.userClaims?.email),
      // La API no tiene memoria: se reenvía el historial. Solo los últimos 20 mensajes.
      messages: await convertToModelMessages(body.messages.slice(-20)),
      temperature: 0.4,
      maxRetries: 1,
      maxOutputTokens: 1024,
      // Si la app presiona ■, la conexión se cierra: con la señal de la petición el stream
      // termina como "abortado" y no como error (antes la app mostraba "no pudo responder")
      abortSignal: req.signal,
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        // Lo que devuelve onError es lo que ve el usuario en error.message
        onError: (error) => {
          console.error(error);
          if (esCuotaGemini(error)) {
            return 'Se agotó la cuota gratuita de Gemini. Espera un minuto e intenta de nuevo.';
          }
          return 'El tutor no pudo responder. Intenta de nuevo.';
        },
      }),
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Encoding': 'none' },
    });
  }),
};
