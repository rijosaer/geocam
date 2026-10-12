import { Directory, File, Paths } from 'expo-file-system';

const PHOTOS_DIRECTORY = 'photos';
const DEFAULT_EXTENSION = '.jpg';

function getPhotosDirectory(): Directory {
  const directory = new Directory(Paths.document, PHOTOS_DIRECTORY);
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
  return directory;
}

export async function persistPhoto(cacheUri: string): Promise<string> {
  const directory = getPhotosDirectory();
  const source = new File(cacheUri);
  const extension = source.extension || DEFAULT_EXTENSION;
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`;
  const destination = new File(directory, name);
  await source.copy(destination);
  return destination.uri;
}

// El registro ya se borró: un archivo que no se puede eliminar no debe romper la acción
export function deletePhotoFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch (e) {
    console.warn('No se pudo borrar el archivo de la foto', uri, e);
  }
}
