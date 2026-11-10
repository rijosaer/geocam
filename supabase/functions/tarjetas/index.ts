// C3. Edge Function "tarjetas": de 3 a 5 tarjetas de repaso (pregunta y respuesta) a partir
// de la conversación con el tutor. Salida estructurada: generateText + Output.object con zod.
// Despliegue: npx supabase functions deploy tarjetas
import { withSupabase } from 'npm:@supabase/server@1';
import { generateText, Output } from 'npm:ai@7';
import { z } from 'npm:zod@4';
import { consumirCupo, google, jsonError, MODELO, respuestaErrorGemini } from '../_shared/ia.ts';

// Solo el texto de la conversación: las fotos no hacen falta para repasar y gastan tokens
const Entrada = z.object({
  mensajes: z
    .array(
      z.object({
        rol: z.enum(['user', 'assistant']),
        texto: z.string().max(8000),
      })
    )
    .min(2)
    .max(40),
});

const Tarjetas = z.object({
  tarjetas: z
    .array(
      z.object({
        pregunta: z.string().min(5).max(200),
        respuesta: z.string().min(1).max(500),
      })
    )
    .min(3)
    .max(5),
});

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return jsonError(405, 'metodo', 'Usa POST');

    const entrada = Entrada.safeParse(await req.json().catch(() => null));
    if (!entrada.success) {
      return jsonError(400, 'entrada', 'Conversa un poco más con el tutor antes de pedir tarjetas.');
    }

    const sinCupo = await consumirCupo(ctx.supabase, 'tarjetas');
    if (sinCupo) return sinCupo;

    const conversacion = entrada.data.mensajes
      .map((m) => `${m.rol === 'user' ? 'Estudiante' : 'Tutor'}: ${m.texto}`)
      .join('\n\n');

    try {
      const { output } = await generateText({
        model: google(MODELO),
        instructions:
          'Creas tarjetas de repaso en español para un estudiante de Programación Móvil. ' +
          'Usa SOLO lo que se habló en la conversación; no agregues temas nuevos. ' +
          'Cada pregunta se responde en una o dos oraciones. Escribe con ortografía correcta ' +
          '(tildes y signos ¿?), aunque la conversación no la tenga.',
        prompt: `Conversación:\n\n${conversacion}\n\nGenera entre 3 y 5 tarjetas de repaso.`,
        output: Output.object({ schema: Tarjetas }),
        temperature: 0.3,
        maxRetries: 1,
        maxOutputTokens: 1200,
      });
      return Response.json(output);
    } catch (error) {
      return respuestaErrorGemini(error);
    }
  }),
};
