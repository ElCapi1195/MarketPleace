import { randomUUID } from 'node:crypto';
import { MAX_IMAGE_BYTES } from '@marketplace/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { glb, jpeg, png } from './support/files.js';
import { startIdentity, type Browser, type TestIdentity } from './support/identity.js';

const MODEL = 'model/gltf-binary';

let db: TestDatabase;
let t: TestIdentity;
let admin: Browser;
let visitor: Browser;
let storeId: string;

beforeAll(async () => {
  db = await createTestDatabase();
  t = await startIdentity(db.appUrl);
  admin = await t.signedIn('admin');
  visitor = t.browser();
  storeId = (await admin.post('/api/admin/stores', { name: 'Tienda' })).body.id;
}, 90_000);

afterAll(async () => {
  await t?.stop();
  await db?.stop();
}, 30_000);

async function product(): Promise<string> {
  const res = await admin.post('/api/admin/products', {
    storeId,
    title: 'Juego de prueba',
    description: '',
    categorySlug: 'juegos',
    kind: 'IN_STOCK',
    priceMinor: 100,
    depositMinor: 0,
    units: null,
    availableOn: null,
    attributes: { platform: 'pc', condition: 'nuevo' },
    featured: false,
  });
  return res.body.id;
}

const mediaUrl = (id: string) => `/api/admin/products/${id}/media`;
const addImage = async (id: string) => admin.upload(mediaUrl(id), await jpeg(), 'image/jpeg');

describe('subir', () => {
  it('guarda una foto recodificada y la devuelve con sus medidas', async () => {
    const res = await addImage(await product());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ kind: 'IMAGE', width: 400, height: 300, position: 0, alt: '' });
    expect(t.storage.files.get(`${res.body.id}/sm`)?.toString('latin1', 8, 12)).toBe('WEBP');
  });

  it('guarda un modelo 3D; subir otro lo sustituye y elimina el anterior', async () => {
    const id = await product();
    const first = await admin.upload(mediaUrl(id), glb(), MODEL);
    expect([first.status, first.body.kind]).toEqual([201, 'MODEL']);
    const second = await admin.upload(mediaUrl(id), glb(), MODEL);
    expect(second.status).toBe(201);
    expect(t.storage.files.has(`${first.body.id}/model`)).toBe(false);
    expect(t.storage.files.has(`${second.body.id}/model`)).toBe(true);
    const { body } = await admin.get(`/api/admin/products/${id}`);
    expect(body.media.map((item: { id: string }) => item.id)).toEqual([second.body.id]);
  });

  it.each([
    ['HTML como JPEG', Buffer.from('<!doctype html><script>alert(1)</script>'), 'image/jpeg', 415, 'UNSUPPORTED_IMAGE'],
    ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml', 415, 'UNSUPPORTED_MEDIA_TYPE'],
    ['formulario', Buffer.from('a=b'), 'application/x-www-form-urlencoded', 415, 'UNSUPPORTED_MEDIA_TYPE'],
    ['modelo falso', Buffer.from('no soy un modelo y ocupo bastante'), MODEL, 422, 'INVALID_MODEL'],
    ['foto enorme', Buffer.alloc(MAX_IMAGE_BYTES + 1), 'image/png', 413, 'FILE_TOO_LARGE'],
  ])('rechaza %s y no guarda nada', async (_name, body, type, status, code) => {
    const id = await product();
    const before = t.storage.files.size;
    const res = await admin.upload(mediaUrl(id), body, type);
    expect([res.status, res.body.error.code]).toEqual([status, code]);
    expect(t.storage.files.size).toBe(before);
    expect((await admin.get(`/api/admin/products/${id}`)).body.media).toEqual([]);
  });

  it('en un producto que no existe da 404 y no guarda nada', async () => {
    const before = t.storage.files.size;
    expect((await addImage(randomUUID())).status).toBe(404);
    expect(t.storage.files.size).toBe(before);
  });

  it('respeta el máximo de fotos aunque lleguen a la vez', async () => {
    const id = await product();
    for (let index = 0; index < 7; index += 1) await addImage(id);
    const before = t.storage.files.size;
    const results = await Promise.all([addImage(id), addImage(id), addImage(id)]);
    expect(results.map((res) => res.status).toSorted()).toEqual([201, 409, 409]);
    const { body } = await admin.get(`/api/admin/products/${id}`);
    expect(body.media.map((item: { position: number }) => item.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(t.storage.files.size).toBe(before + 2);
  }, 20_000);

  it('una petición de otro sitio se rechaza', async () => {
    const id = await product();
    const res = await admin.send('post', mediaUrl(id), await png(), { 'content-type': 'image/png', origin: 'https://malo.test' });
    expect([res.status, res.body.error.code]).toEqual([403, 'INVALID_ORIGIN']);
  });
});

describe('ver', () => {
  it('la foto de un borrador no es pública, la de un publicado sí, y la de un archivado deja de serlo', async () => {
    const id = await product();
    const { body: media } = await addImage(id);
    const url = `/api/media/${media.id}/sm`;
    expect((await visitor.get(url)).status).toBe(404);
    expect((await admin.get(`/api/admin/media/${media.id}/sm`)).status).toBe(200);

    await admin.post(`/api/admin/products/${id}/publish`);
    const res = await visitor.get(url);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      'content-type': 'image/webp',
      'x-content-type-options': 'nosniff',
      'content-security-policy': expect.stringContaining("default-src 'none'"),
      'cache-control': 'public, max-age=86400',
    });

    await admin.post(`/api/admin/products/${id}/archive`);
    expect((await visitor.get(url)).status).toBe(404);
  });

  it('el borrador que ve el administrador no se guarda en cachés', async () => {
    const { body: media } = await addImage(await product());
    expect((await admin.get(`/api/admin/media/${media.id}/lg`)).headers['cache-control']).toBe('private, no-store');
  });

  it('el modelo se sirve con su tipo', async () => {
    const id = await product();
    const { body: media } = await admin.upload(mediaUrl(id), glb(), MODEL);
    const res = await admin.get(`/api/admin/media/${media.id}/model`);
    expect([res.status, res.headers['content-type']]).toEqual([200, MODEL]);
  });

  it.each(['/api/media/no-es-un-id/sm', `/api/media/${randomUUID()}/sm`, `/api/media/${randomUUID()}/..%2F..%2Fpasswd`])(
    'da 404 en %s',
    async (url) => {
      expect((await visitor.get(url)).status).toBe(404);
    },
  );

  it('una variante que el archivo no tiene da 404', async () => {
    const { body: media } = await addImage(await product());
    expect((await admin.get(`/api/admin/media/${media.id}/model`)).status).toBe(404);
  });
});

describe('ordenar, describir y eliminar', () => {
  it('mueve una foto al principio y la convierte en portada', async () => {
    const id = await product();
    const ids = [];
    for (let index = 0; index < 3; index += 1) ids.push((await addImage(id)).body.id);
    const res = await admin.patch(`/api/admin/media/${ids[2]}`, { position: 0, alt: ' Vista frontal ' });
    expect(res.status).toBe(200);
    const { body } = await admin.get(`/api/admin/products/${id}`);
    expect(body.media.map((item: { id: string }) => item.id)).toEqual([ids[2], ids[0], ids[1]]);
    expect(body.media[0].alt).toBe('Vista frontal');
  });

  it('una posición fuera de rango la deja al final', async () => {
    const id = await product();
    const first = (await addImage(id)).body.id;
    const second = (await addImage(id)).body.id;
    await admin.patch(`/api/admin/media/${first}`, { position: 30 });
    const { body } = await admin.get(`/api/admin/products/${id}`);
    expect(body.media.map((item: { id: string }) => item.id)).toEqual([second, first]);
  });

  it('eliminar borra también los archivos y cierra el hueco', async () => {
    const id = await product();
    const first = (await addImage(id)).body.id;
    const second = (await addImage(id)).body.id;
    expect((await admin.delete(`/api/admin/media/${first}`)).status).toBe(204);
    expect(t.storage.files.has(`${first}/lg`)).toBe(false);
    const { body } = await admin.get(`/api/admin/products/${id}`);
    expect(body.media).toMatchObject([{ id: second, position: 0 }]);
    expect((await admin.delete(`/api/admin/media/${first}`)).status).toBe(404);
  });

  it('no deja sin fotos a un producto publicado', async () => {
    const id = await product();
    const { body: media } = await addImage(id);
    await admin.post(`/api/admin/products/${id}/publish`);
    const res = await admin.delete(`/api/admin/media/${media.id}`);
    expect([res.status, res.body.error.code]).toEqual([409, 'LAST_IMAGE']);
  });
});
