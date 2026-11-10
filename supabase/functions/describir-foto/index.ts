// T1. Edge Function "describir-foto": recibe la foto como data URL JPEG y responde
// { descripcion }. Sin streaming: una sola respuesta, con generateText + Output.object.
// Despliegue: npx supabase functions deploy describir-foto
import { withSupabase } from 'npm:@supabase/server@1';
import { generateText, Output } from 'npm:ai@7';
import { z } from 'npm:zod@4';
import { consumirCupo, google, jsonError, MODELO, respuestaErrorGemini } from '../_shared/ia.ts';

const PREFIJO = 'data:image/jpeg;base64,';

// La app reduce la foto a 1024 px y JPEG 0.7 (unos 150 KB). Se rechaza lo que pase de ~450 KB
// en base64 para que nadie use la función para enviar imágenes enormes con nuestra key.
const Entrada = z.object({
  imagen: z.string().startsWith(PREFIJO).max(600_000),
});

const Salida = z.object({
  descripcion: z
    .string()
    .min(1)
    .max(600)
    .describe('Descripción de la foto en español, de una a tres oraciones.'),
});

export default {
  // auth: 'user' => sin token de sesión válido responde 401 y nunca llega a Gemini.
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return jsonError(405, 'metodo', 'Usa POST');

    const entrada = Entrada.safeParse(await req.json().catch(() => null));
    if (!entrada.success) {
      return jsonError(400, 'entrada', 'Envía la foto como data URL JPEG (data:image/jpeg;base64,...).');
    }

    const sinCupo = await consumirCupo(ctx.supabase, 'describir-foto');
    if (sinCupo) return sinCupo;

    try {
      const { output } = await generateText({
        model: google(MODELO),
        instructions:
          'Describes fotos tomadas con una app de cámara geolocalizada. Responde en español, ' +
          'en una a tres oraciones: qué se ve y dónde parece estar. No inventes nombres de ' +
          'lugares ni personas; si algo no se distingue, dilo.',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe esta foto.' },
              // La imagen va en base64 SIN el prefijo "data:image/jpeg;base64,"
              { type: 'file', mediaType: 'image/jpeg', data: entrada.data.imagen.slice(PREFIJO.length) },
            ],
          },
        ],
        output: Output.object({ schema: Salida }),
        temperature: 0.2, // descripción estable, no creativa
        maxRetries: 1,
        maxOutputTokens: 300,
      });
      return Response.json({ descripcion: output.descripcion.trim() });
    } catch (error) {
      return respuestaErrorGemini(error);
    }
  }),
};
