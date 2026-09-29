import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { GeoPhotosProvider, useGeoPhotos } from '@/context/GeoPhotosContext';
import type { GeoPhoto } from '@/types/geo';

const wrapper = ({ children }: { children: ReactNode }) => (
  <GeoPhotosProvider>{children}</GeoPhotosProvider>
);

const photo = (id: string, source: GeoPhoto['source'] = 'camera'): GeoPhoto => ({
  id,
  uri: `file://${id}.jpg`,
  coords: null,
  source,
  createdAt: Number(id),
});

test('fuera del Provider lanza un error claro', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await expect(renderHook(() => useGeoPhotos())).rejects.toThrow(
    'useGeoPhotos debe usarse dentro de GeoPhotosProvider'
  );
});

test('addPhoto agrega al inicio sin mutar la lista anterior', async () => {
  const { result } = await renderHook(() => useGeoPhotos(), { wrapper });
  await act(async () => result.current.addPhoto(photo('1')));
  const before = result.current.photos;

  await act(async () => result.current.addPhoto(photo('2', 'gallery')));

  expect(result.current.photos.map((p) => p.id)).toEqual(['2', '1']);
  expect(before.map((p) => p.id)).toEqual(['1']);
  expect(result.current.photos).not.toBe(before);
});

test('removePhoto quita solo la foto indicada', async () => {
  const { result } = await renderHook(() => useGeoPhotos(), { wrapper });
  await act(async () => {
    result.current.addPhoto(photo('1'));
    result.current.addPhoto(photo('2'));
  });

  await act(async () => result.current.removePhoto('1'));

  expect(result.current.photos.map((p) => p.id)).toEqual(['2']);
});

test('clearAll vacía la lista', async () => {
  const { result } = await renderHook(() => useGeoPhotos(), { wrapper });
  await act(async () => {
    result.current.addPhoto(photo('1'));
    result.current.addPhoto(photo('2'));
  });

  await act(async () => result.current.clearAll());

  expect(result.current.photos).toEqual([]);
});
