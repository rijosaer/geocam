// T2. "GeoCam ve": reduce la foto y pide su descripción a la Edge Function describir-foto.
// La foto sale del teléfono hacia Supabase y de ahí a Google Gemini (la pantalla lo avisa).
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import type { FileUIPart } from 'ai';
import { IAError, invocarFuncion } from '@/services/ia';

const ANCHO = 1024;
const CALIDAD = 0.7;
// T2 pide que la petición pese menos de 300 KB
export const MAX_BYTES_PETICION = 300 * 1024;

export interface FotoReducida {
  dataUrl: string; // data:image/jpeg;base64,...
  bytes: number; // tamaño aproximado del cuerpo de la petición
}

async function reducir(uri: string, compress: number): Promise<FotoReducida> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: ANCHO });
  const imagen = await ctx.renderAsync();
  const guardada = await imagen.saveAsync({ format: SaveFormat.JPEG, compress, base64: true });
  if (!guardada.base64) throw new IAError('entrada', 'No se pudo preparar la foto.');
  const dataUrl = `data:image/jpeg;base64,${guardada.base64}`;
  return { dataUrl, bytes: dataUrl.length };
}

/** 1024 px de ancho y JPEG 0.7 (unos 150 KB). Si aún pesa más de 300 KB, se comprime más. */
export async function reducirFoto(uri: string): Promise<FotoReducida> {
  let foto = await reducir(uri, CALIDAD);
  if (foto.bytes > MAX_BYTES_PETICION) foto = await reducir(uri, 0.5);
  return foto;
}

/** Devuelve la descripción sugerida por la IA. Lanza IAError con un mensaje claro si falla. */
export async function describirFoto(uri: string): Promise<string> {
  const foto = await reducirFoto(uri);
  console.log(`describir-foto: petición de ${Math.round(foto.bytes / 1024)} KB`);
  const { descripcion } = await invocarFuncion<{ descripcion: string }>('describir-foto', {
    imagen: foto.dataUrl,
  });
  return descripcion;
}

/** Para el Tutor IA: abre la cámara o la galería y devuelve la foto lista para useChat. */
export async function elegirFotoParaChat(origen: 'camara' | 'galeria'): Promise<FileUIPart | null> {
  const permiso =
    origen === 'camara'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) throw new Error('Sin permiso no se puede adjuntar la foto.');

  const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const res =
    origen === 'camara'
      ? await ImagePicker.launchCameraAsync(opciones)
      : await ImagePicker.launchImageLibraryAsync(opciones);
  if (res.canceled) return null;

  const foto = await reducirFoto(res.assets[0].uri);
  return { type: 'file', mediaType: 'image/jpeg', filename: 'foto.jpg', url: foto.dataUrl };
}
