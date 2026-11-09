// Matriz de pruebas de la Semana 9 (C6) ejecutada sobre el services/sync.ts REAL,
// con dos teléfonos (A y B) y una nube simulados en memoria. No usa red ni dispositivos.
import { remoteWins, isPending, syncAll } from '@/services/sync';

type Source = 'camera' | 'gallery';

interface FakePhoto {
  id: number;
  uri: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  source: Source;
  note: string | null;
  favorite: boolean;
  albumId: number | null;
  createdAt: Date;
  clientId: string | null;
  updatedAt: Date | null;
  remotePath: string | null;
  syncedAt: Date | null;
  ownerId: string | null;
  deletedAt: Date | null;
}

interface FakePhone {
  name: string;
  photos: FakePhoto[];
  meta: Map<string, string>;
  nextId: number;
  deletedFiles: string[];
}

interface RemoteRow {
  client_id: string;
  storage_path: string;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  favorite: boolean;
  source: Source;
  taken_at: string;
  updated_at: string;
  server_updated_at: string;
  deleted_at: string | null;
}

// --- Estado compartido por los mocks (jest exige el prefijo "mock") ---
const mockCloud = {
  online: true,
  rows: new Map<string, RemoteRow>(),
  files: new Set<string>(),
  serverTick: 0,
  upsertCalls: 0,
  failUpsertAfter: Infinity, // corta la red después de N upserts
};
const mockPhones: { current: FakePhone } = { current: newPhone('A') };

function newPhone(name: string): FakePhone {
  return { name, photos: [], meta: new Map(), nextId: 1, deletedFiles: [] };
}

function mockOffline() {
  if (!mockCloud.online) throw new Error('Network request failed');
}

jest.mock('@/services/cloudPhotos', () => ({
  fetchChangesSince: async (since: string, limit = 200) => {
    mockOffline();
    return [...mockCloud.rows.values()]
      .filter((r) => r.server_updated_at > since)
      .sort((a, b) => a.server_updated_at.localeCompare(b.server_updated_at))
      .slice(0, limit)
      .map((r) => ({ ...r }));
  },
  uploadPhotoFile: async (path: string, uri: string) => {
    mockOffline();
    if (uri.includes('borrado-de-cache')) throw new Error('El archivo local ya no existe');
    mockCloud.files.add(path); // si ya existía, no es error (se tolera "exists")
  },
  upsertRemotePhoto: async (row: Omit<RemoteRow, 'server_updated_at'>) => {
    mockOffline();
    if (mockCloud.upsertCalls >= mockCloud.failUpsertAfter) {
      mockCloud.online = false; // la red se cae a mitad del ciclo
      throw new Error('Network request failed');
    }
    mockCloud.upsertCalls++;
    mockCloud.serverTick++;
    // Reloj del servidor: siempre creciente, como now() en el trigger
    const server_updated_at = new Date(Date.UTC(2026, 0, 1, 0, 0, mockCloud.serverTick)).toISOString();
    mockCloud.rows.set(row.client_id, { ...row, server_updated_at });
  },
  removeRemoteFile: async (path: string) => {
    mockOffline();
    mockCloud.files.delete(path);
  },
}));

jest.mock('@/services/photoFiles', () => ({
  downloadPhotoFile: async (_path: string, clientId: string) =>
    `file:///${mockPhones.current.name}/photos/${clientId}.jpg`,
  deletePhotoFile: (uri: string) => {
    mockPhones.current.deletedFiles.push(uri);
  },
}));

jest.mock('@/db/repositories/syncMeta', () => ({
  syncMetaRepo: {
    get: async (key: string) => mockPhones.current.meta.get(key) ?? null,
    set: async (key: string, value: string) => {
      mockPhones.current.meta.set(key, value);
    },
  },
}));

jest.mock('@/db/repositories/photos', () => {
  const phone = () => mockPhones.current;
  const byId = (id: number) => phone().photos.find((p) => p.id === id)!;
  const pending = (p: FakePhoto) =>
    !p.syncedAt || !p.updatedAt || p.updatedAt.getTime() > p.syncedAt.getTime();
  return {
    photosRepo: {
      findByClientId: async (clientId: string) =>
        phone().photos.find((p) => p.clientId === clientId),
      insertFromRemote: async (data: Partial<FakePhoto>) => {
        phone().photos.push({
          id: phone().nextId++,
          accuracy: null,
          albumId: null,
          deletedAt: null,
          ...data,
        } as FakePhoto);
      },
      applyRemote: async (id: number, changes: Partial<FakePhoto>) => {
        Object.assign(byId(id), changes);
      },
      purge: async (id: number) => {
        phone().photos = phone().photos.filter((p) => p.id !== id);
      },
      clearRemotePath: async (id: number) => {
        byId(id).remotePath = null;
      },
      listPending: async (ownerId: string) =>
        phone().photos.filter((p) => p.ownerId === ownerId && pending(p)),
      markSynced: async (id: number, remotePath: string, syncedAt: Date) => {
        Object.assign(byId(id), { remotePath, syncedAt });
      },
    },
  };
});

// --- Ayudas: acciones del usuario en un teléfono, con la hora explícita ---
const USER = 'user-1';
const t = (minute: number) => new Date(Date.UTC(2026, 10, 9, 10, minute));
let uuid = 0;

function on(phone: FakePhone) {
  mockPhones.current = phone;
}

function takePhoto(phone: FakePhone, at: Date, extra: Partial<FakePhoto> = {}) {
  uuid++;
  const photo: FakePhoto = {
    id: phone.nextId++,
    uri: `file:///${phone.name}/photos/foto-${uuid}.jpg`,
    latitude: 11.54,
    longitude: -72.91,
    accuracy: 5,
    source: 'camera',
    note: null,
    favorite: false,
    albumId: null,
    createdAt: at,
    clientId: `client-${uuid}`,
    updatedAt: at,
    remotePath: null,
    syncedAt: null,
    ownerId: USER,
    deletedAt: null,
    ...extra,
  };
  phone.photos.push(photo);
  return photo.clientId!;
}

const find = (phone: FakePhone, clientId: string) =>
  phone.photos.find((p) => p.clientId === clientId);

function editNote(phone: FakePhone, clientId: string, note: string, at: Date) {
  Object.assign(find(phone, clientId)!, { note, updatedAt: at });
}

function markDeleted(phone: FakePhone, clientId: string, at: Date) {
  Object.assign(find(phone, clientId)!, { deletedAt: at, updatedAt: at });
}

async function sync(phone: FakePhone) {
  on(phone);
  return syncAll(USER);
}

const pendingCount = (phone: FakePhone) =>
  phone.photos.filter((p) => !p.syncedAt || p.updatedAt!.getTime() > p.syncedAt.getTime()).length;
// Lo que la UI muestra: las marcadas como borradas no se ven
const visible = (phone: FakePhone) => phone.photos.filter((p) => !p.deletedAt);

let A: FakePhone;
let B: FakePhone;

beforeEach(() => {
  mockCloud.online = true;
  mockCloud.rows.clear();
  mockCloud.files.clear();
  mockCloud.serverTick = 0;
  mockCloud.upsertCalls = 0;
  mockCloud.failUpsertAfter = Infinity;
  A = newPhone('A');
  B = newPhone('B');
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('regla de conflicto (función pura)', () => {
  it('gana la versión con updatedAt más reciente', () => {
    expect(remoteWins(t(1), t(2).toISOString())).toBe(true);
    expect(remoteWins(t(2), t(1).toISOString())).toBe(false);
  });
  it('con fechas iguales no gana nadie (ya están sincronizados)', () => {
    expect(remoteWins(t(1), t(1).toISOString())).toBe(false);
  });
  it('una foto local sin fecha pierde frente a cualquier versión remota', () => {
    expect(remoteWins(null, t(0).toISOString())).toBe(true);
  });
  it('pendiente = nunca subida o editada después de subir', () => {
    expect(isPending({ syncedAt: null, updatedAt: t(1) })).toBe(true);
    expect(isPending({ syncedAt: t(1), updatedAt: t(2) })).toBe(true);
    expect(isPending({ syncedAt: t(2), updatedAt: t(2) })).toBe(false);
  });
});

describe('matriz de pruebas C6', () => {
  it('1. foto tomada sin conexión se sube sola al reconectar y pendientes vuelve a 0', async () => {
    mockCloud.online = false;
    const id = takePhoto(A, t(1));
    await expect(sync(A)).rejects.toThrow('Network request failed');
    expect(pendingCount(A)).toBe(1);

    mockCloud.online = true;
    await sync(A);
    expect(pendingCount(A)).toBe(0);
    expect(mockCloud.rows.get(id)?.storage_path).toBe(`${USER}/${id}.jpg`);
    expect(mockCloud.files.has(`${USER}/${id}.jpg`)).toBe(true);
  });

  it('2. foto creada en A aparece en B con imagen y ubicación', async () => {
    const id = takePhoto(A, t(1));
    await sync(A);
    await sync(B);
    const copy = find(B, id);
    expect(copy?.uri).toBe(`file:///B/photos/${id}.jpg`);
    expect(copy?.latitude).toBe(11.54);
    expect(copy?.longitude).toBe(-72.91);
    expect(pendingCount(B)).toBe(0); // nace sincronizada: no se vuelve a subir
  });

  it.each([
    ['A reconecta primero', ['A', 'B', 'A']],
    ['B reconecta primero', ['B', 'A', 'B']],
  ])('3. conflicto de notas sin conexión: queda la de B en los dos (%s)', async (_, order) => {
    const id = takePhoto(A, t(1));
    await sync(A);
    await sync(B);

    mockCloud.online = false;
    editNote(A, id, 'nota de A', t(5));
    editNote(B, id, 'nota de B', t(6)); // un minuto después
    mockCloud.online = true;

    for (const name of order) await sync(name === 'A' ? A : B);
    expect(find(A, id)?.note).toBe('nota de B');
    expect(find(B, id)?.note).toBe('nota de B');
    expect(mockCloud.rows.get(id)?.note).toBe('nota de B');
  });

  it('4. foto borrada en A desaparece en B y del bucket', async () => {
    const id = takePhoto(A, t(1));
    await sync(A);
    await sync(B);
    expect(find(B, id)).toBeDefined();

    markDeleted(A, id, t(3));
    expect(visible(A)).toHaveLength(0); // la UI la oculta de inmediato
    await sync(A);
    expect(find(A, id)).toBeUndefined(); // marca sincronizada: se borra la fila local
    expect(A.deletedFiles).toContain(`file:///A/photos/foto-${uuid}.jpg`);
    expect(mockCloud.files.has(`${USER}/${id}.jpg`)).toBe(false);
    expect(mockCloud.rows.get(id)?.deleted_at).toBe(t(3).toISOString());

    await sync(B);
    expect(find(B, id)).toBeUndefined();
    expect(B.deletedFiles).toContain(`file:///B/photos/${id}.jpg`);
  });

  it.each([
    ['A reconecta primero', ['A', 'B', 'A']],
    ['B reconecta primero', ['B', 'A', 'B']],
  ])('5. editada en A y borrada después en B, sin conexión: queda borrada en los dos (%s)', async (_, order) => {
    const id = takePhoto(A, t(1));
    await sync(A);
    await sync(B);

    mockCloud.online = false;
    editNote(A, id, 'editada en A', t(5));
    markDeleted(B, id, t(6)); // el borrado es el último cambio
    mockCloud.online = true;

    for (const name of order) await sync(name === 'A' ? A : B);
    expect(find(A, id)).toBeUndefined();
    expect(find(B, id)).toBeUndefined();
    expect(mockCloud.rows.get(id)?.deleted_at).not.toBeNull();
    expect(mockCloud.files.has(`${USER}/${id}.jpg`)).toBe(false);
  });

  it('5b. al revés: borrada en B y editada DESPUÉS en A, gana la edición y la foto vuelve', async () => {
    const id = takePhoto(A, t(1));
    await sync(A);
    await sync(B);

    mockCloud.online = false;
    markDeleted(B, id, t(5));
    editNote(A, id, 'la edición es posterior', t(6));
    mockCloud.online = true;

    await sync(B); // sube el borrado y elimina el archivo del bucket
    await sync(A); // la edición es más nueva: se vuelve a subir completa
    await sync(B);
    expect(find(A, id)?.note).toBe('la edición es posterior');
    expect(find(B, id)?.note).toBe('la edición es posterior');
    expect(mockCloud.rows.get(id)?.deleted_at).toBeNull();
    expect(mockCloud.files.has(`${USER}/${id}.jpg`)).toBe(true);
  });

  it('6. se corta la red a mitad de una sincronización de 5 fotos: al reconectar no duplica', async () => {
    const ids = [1, 2, 3, 4, 5].map((m) => takePhoto(A, t(m)));
    mockCloud.failUpsertAfter = 2; // la red se cae después de la segunda fila

    const first = await sync(A);
    expect(first.pushed).toBe(2);
    expect(first.failed).toBe(3); // C5: las demás no se pierden, quedan pendientes
    expect(pendingCount(A)).toBe(3);

    mockCloud.online = true;
    mockCloud.failUpsertAfter = Infinity;
    await sync(A);
    await sync(A); // repetir no cambia nada (idempotente)
    expect(pendingCount(A)).toBe(0);
    expect(mockCloud.rows.size).toBe(5);
    expect(mockCloud.files.size).toBe(5);
    for (const id of ids) expect(mockCloud.rows.has(id)).toBe(true);
  });

  it('C5. si una foto falla al subir, las demás continúan y la que falló queda pendiente', async () => {
    takePhoto(A, t(1));
    const broken = takePhoto(A, t(2), { uri: 'file:///A/cache/borrado-de-cache.jpg' });
    takePhoto(A, t(3));

    const result = await sync(A);
    expect(result.pushed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.lastError).toBe('El archivo local ya no existe');
    expect(pendingCount(A)).toBe(1);
    expect(find(A, broken)?.syncedAt).toBeNull();
    // El último resultado queda guardado para la pantalla de estado (C4)
    expect(JSON.parse(A.meta.get(`lastSync:${USER}`)!)).toMatchObject({ pushed: 2, failed: 1, ok: true });
  });

  it('repetir la sincronización varias veces seguidas no duplica filas ni archivos', async () => {
    takePhoto(A, t(1));
    takePhoto(A, t(2));
    await Promise.all([sync(A), sync(A), sync(A)]); // llamadas simultáneas: un solo ciclo
    await sync(A);
    expect(mockCloud.rows.size).toBe(2);
    expect(mockCloud.files.size).toBe(2);
  });

  it('una foto borrada que nunca llegó a la nube se elimina sin tocar Supabase', async () => {
    mockCloud.online = false;
    const id = takePhoto(A, t(1));
    markDeleted(A, id, t(2));
    mockCloud.online = true;
    await sync(A);
    expect(find(A, id)).toBeUndefined();
    expect(mockCloud.rows.has(id)).toBe(false);
  });
});
