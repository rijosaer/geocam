// C4/C6: cada respuesta de las Edge Functions se traduce a un mensaje claro para el usuario.
import { errorDeRespuesta, errorDeRed, IAError } from '@/services/ia';

jest.mock('@/lib/supabase', () => ({ supabase: { auth: { signOut: jest.fn() } } }));

const respuesta = (status: number, body: unknown) =>
  ({
    status,
    json: async () => {
      if (body === undefined) throw new Error('sin cuerpo');
      return body;
    },
  }) as unknown as Response;

describe('errores de IA', () => {
  it('401 de la plataforma: sesión vencida, con mensaje en español', async () => {
    const e = await errorDeRespuesta(respuesta(401, { code: 401, message: 'Invalid JWT' }));
    expect(e).toBeInstanceOf(IAError);
    expect(e.kind).toBe('sesion');
    expect(e.message).toBe('Tu sesión venció. Vuelve a iniciar sesión.');
  });

  it('429 por el límite diario (C5) usa el mensaje del servidor', async () => {
    const e = await errorDeRespuesta(
      respuesta(429, { error: 'limite_diario', mensaje: 'Llegaste a tu límite de 3 consultas.' })
    );
    expect(e.kind).toBe('limite_diario');
    expect(e.message).toBe('Llegaste a tu límite de 3 consultas.');
  });

  it('429 de Gemini se distingue del límite propio', async () => {
    const e = await errorDeRespuesta(respuesta(429, { error: 'cuota_gemini', mensaje: 'Cuota' }));
    expect(e.kind).toBe('cuota_gemini');
  });

  it('5xx sin cuerpo JSON: mensaje genérico, nunca el error crudo', async () => {
    const e = await errorDeRespuesta(respuesta(502, undefined));
    expect(e.kind).toBe('servidor');
    expect(e.message).toBe('La IA no pudo responder. Intenta de nuevo.');
  });

  it('sin red', () => {
    expect(errorDeRed().kind).toBe('sin_red');
  });
});
