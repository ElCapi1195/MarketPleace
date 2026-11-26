import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { glb, jpeg } from './support/files.js';
import { startIdentity, type Browser, type TestIdentity } from './support/identity.js';
import { approvedStore, decide, readyStore } from './support/stores.js';

let db: TestDatabase;
let t: TestIdentity;
let admin: Browser;
let moderator: Browser;
let visitor: Browser;

beforeAll(async () => {
  db = await createTestDatabase();
  t = await startIdentity(db.appUrl);
  [admin, moderator, visitor] = [await t.signedIn('admin'), await t.signedIn('moderator'), t.browser()];
}, 90_000);

afterAll(async () => {
  await t?.stop();
  await db?.stop();
}, 30_000);

const input = (storeId: string, patch: object = {}) => ({
  storeId,
  title: 'Juego de tienda',
  description: '',
  categorySlug: 'juegos',
  kind: 'IN_STOCK',
  priceMinor: 1000,
  depositMinor: 0,
  units: 2,
  availableOn: null,
  attributes: { platform: 'pc', condition: 'nuevo' },
  featured: false,
  ...patch,
});

interface Shop {
  owner: Browser;
  id: string;
}

async function draft({ owner, id }: Shop, patch: object = {}) {
  const res = await owner.post(`/api/stores/${id}/products`, input(id, patch));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const image = await owner.upload(`/api/stores/${id}/products/${res.body.id}/media`, await jpeg(), 'image/jpeg');
  expect(image.status, JSON.stringify(image.body)).toBe(201);
  return { ...res.body, imageId: image.body.id };
}

const moderate = (who: Browser, id: string, body: object) => who.post(`/api/admin/moderation/${id}/decision`, body);
const read = async ({ owner, id }: Shop, productId: string) => (await owner.get(`/api/stores/${id}/products/${productId}`)).body;

async function published(shop: Shop, patch: object = {}) {
  const product = await draft(shop, patch);
  await shop.owner.post(`/api/stores/${shop.id}/products/${product.id}/submit`);
  const { version } = await read(shop, product.id);
  expect((await moderate(moderator, product.id, { action: 'approve', version })).status).toBe(200);
  return product;
}

const visible = async (slug: string) => (await visitor.get(`/api/catalog/products/${slug}`)).status === 200;

describe('publicar desde la tienda', () => {
  it('pasa por moderación antes de verse', async () => {
    const shop = await approvedStore(t, admin);
    const product = await draft(shop, { title: 'Espera revisión' });
    const sent = await shop.owner.post(`/api/stores/${shop.id}/products/${product.id}/submit`);
    expect(sent.body.status).toBe('PENDING_MODERATION');
    expect(await visible(product.slug)).toBe(false);
    const queue = (await moderator.get('/api/admin/moderation')).body.items;
    expect(queue.map((item: { id: string }) => item.id)).toContain(product.id);
    const res = await moderate(moderator, product.id, { action: 'approve', version: sent.body.version });
    expect(res.body.status).toBe('PUBLISHED');
    expect(await visible(product.slug)).toBe(true);
  });

  it('la tienda no puede publicarse a sí misma ni destacar', async () => {
    const shop = await approvedStore(t, admin);
    const product = await draft(shop, { featured: true });
    expect(product.featured).toBe(false);
    expect((await shop.owner.post(`/api/stores/${shop.id}/products/${product.id}/publish`)).status).toBe(404);
    expect((await shop.owner.post(`/api/admin/products/${product.id}/publish`)).status).toBe(403);
  });

  it('no se envía sin foto', async () => {
    const shop = await approvedStore(t, admin);
    const { body } = await shop.owner.post(`/api/stores/${shop.id}/products`, input(shop.id));
    const res = await shop.owner.post(`/api/stores/${shop.id}/products/${body.id}/submit`);
    expect([res.status, res.body.error.code]).toEqual([422, 'IMAGE_REQUIRED']);
  });

  it('un rechazo explica el motivo y permite volver a enviar', async () => {
    const shop = await approvedStore(t, admin);
    const product = await draft(shop);
    const sent = await shop.owner.post(`/api/stores/${shop.id}/products/${product.id}/submit`);
    await moderate(moderator, product.id, { action: 'reject', version: sent.body.version, reason: 'Foto borrosa' });
    expect(await read(shop, product.id)).toMatchObject({ status: 'REJECTED', rejection: 'Foto borrosa' });
    const again = await shop.owner.post(`/api/stores/${shop.id}/products/${product.id}/submit`);
    expect(again.body).toMatchObject({ status: 'PENDING_MODERATION', rejection: '' });
  });

  it('no puede crear productos a nombre de otra tienda', async () => {
    const [a, b] = [await approvedStore(t, admin), await approvedStore(t, admin)];
    const res = await a.owner.post(`/api/stores/${a.id}/products`, input(b.id));
    expect([res.status, res.body.error.code]).toEqual([400, 'VALIDATION_ERROR']);
    const own = await draft(a);
    const move = await a.owner.patch(`/api/stores/${a.id}/products/${own.id}`, { version: own.version, product: input(b.id) });
    expect(move.status).toBe(400);
  });
});

describe('volver a moderación', () => {
  it.each([
    ['título', { title: 'Otro título' }],
    ['precio', { priceMinor: 1 }],
    ['categoría', { categorySlug: 'accesorios' }],
  ])('cambiar el %s de un publicado lo oculta hasta revisarlo', async (_name, patch) => {
    const shop = await approvedStore(t, admin);
    const product = await published(shop);
    const { version } = await read(shop, product.id);
    const res = await shop.owner.patch(`/api/stores/${shop.id}/products/${product.id}`, { version, product: input(shop.id, patch) });
    expect(res.body.status).toBe('PENDING_MODERATION');
    expect(await visible(product.slug)).toBe(false);
  });

  it('cambiar las unidades o la descripción no lo oculta', async () => {
    const shop = await approvedStore(t, admin);
    const product = await published(shop);
    const { version } = await read(shop, product.id);
    const res = await shop.owner.patch(`/api/stores/${shop.id}/products/${product.id}`, {
      version,
      product: input(shop.id, { units: 9, description: 'Más texto' }),
    });
    expect(res.body.status).toBe('PUBLISHED');
  });

  it.each(['foto nueva', 'modelo', 'descripción de la foto', 'borrar foto'])('cambiar las fotos también: %s', async (change) => {
    const shop = await approvedStore(t, admin);
    const product = await draft(shop);
    await shop.owner.upload(`/api/stores/${shop.id}/products/${product.id}/media`, await jpeg(), 'image/jpeg');
    const sent = await shop.owner.post(`/api/stores/${shop.id}/products/${product.id}/submit`);
    await moderate(moderator, product.id, { action: 'approve', version: sent.body.version });
    const base = `/api/stores/${shop.id}`;
    if (change === 'foto nueva') await shop.owner.upload(`${base}/products/${product.id}/media`, await jpeg(), 'image/jpeg');
    if (change === 'modelo') await shop.owner.upload(`${base}/products/${product.id}/media`, glb(), 'model/gltf-binary');
    if (change === 'descripción de la foto') await shop.owner.patch(`${base}/media/${product.imageId}`, { alt: 'Otro texto' });
    if (change === 'borrar foto') await shop.owner.delete(`${base}/media/${product.imageId}`);
    expect((await read(shop, product.id)).status).toBe('PENDING_MODERATION');
  });

  it('si la tienda cambia el producto mientras se revisa, la decisión no vale', async () => {
    const shop = await approvedStore(t, admin);
    const product = await draft(shop);
    const sent = await shop.owner.post(`/api/stores/${shop.id}/products/${product.id}/submit`);
    await shop.owner.upload(`/api/stores/${shop.id}/products/${product.id}/media`, await jpeg(), 'image/jpeg');
    const res = await moderate(moderator, product.id, { action: 'approve', version: sent.body.version });
    expect([res.status, res.body.error.code]).toEqual([409, 'VERSION_CONFLICT']);
  });

  it('los cambios de la administración no lo ocultan', async () => {
    const shop = await approvedStore(t, admin);
    const product = await published(shop);
    const { version } = (await admin.get(`/api/admin/products/${product.id}`)).body;
    const res = await admin.patch(`/api/admin/products/${product.id}`, { version, product: input(shop.id, { title: 'Corregido', featured: true }) });
    expect(res.body).toMatchObject({ status: 'PUBLISHED', featured: true });
    const again = await shop.owner.patch(`/api/stores/${shop.id}/products/${product.id}`, {
      version: res.body.version,
      product: input(shop.id, { title: 'Corregido', units: 1 }),
    });
    expect(again.body.featured).toBe(true);
  });
});

describe('moderación', () => {
  it('quien modera no decide sobre productos de su tienda', async () => {
    const own = await t.signedIn('moderator');
    const id = await readyStore(own);
    await own.post(`/api/stores/${id}/submit`);
    await decide(admin, id, 'start_review');
    await decide(admin, id, 'approve');
    const product = await draft({ owner: own, id });
    const sent = await own.post(`/api/stores/${id}/products/${product.id}/submit`);
    const res = await moderate(own, product.id, { action: 'approve', version: sent.body.version });
    expect([res.status, res.body.error.code]).toEqual([403, 'OWN_STORE']);
  });

  it('ve las fotos de lo pendiente, no de los borradores', async () => {
    const shop = await approvedStore(t, admin);
    const product = await draft(shop);
    const url = `/api/admin/moderation/media/${product.imageId}/sm`;
    expect((await moderator.get(url)).status).toBe(404);
    await shop.owner.post(`/api/stores/${shop.id}/products/${product.id}/submit`);
    expect((await moderator.get(url)).status).toBe(200);
    expect((await moderator.get(`/api/admin/moderation/${product.id}`)).body).toMatchObject({ id: product.id, status: 'PENDING_MODERATION' });
  });

  it('no decide sobre lo que no está pendiente', async () => {
    const shop = await approvedStore(t, admin);
    const product = await draft(shop);
    expect((await moderate(moderator, product.id, { action: 'approve', version: product.version })).status).toBe(404);
    expect((await moderator.get(`/api/admin/moderation/${product.id}`)).status).toBe(404);
  });

  it('cliente y moderador sin 2FA quedan fuera', async () => {
    for (const [actor, code] of [
      [await t.signedIn('customer', true), 'FORBIDDEN'],
      [await t.signedIn('moderator', false), 'TWO_FACTOR_REQUIRED'],
    ] as const) {
      const id = '019338c2-7a50-4c0e-9d54-2f1a3b4c5d6e';
      for (const res of [
        await actor.get('/api/admin/moderation'),
        await actor.get(`/api/admin/moderation/${id}`),
        await actor.get(`/api/admin/moderation/media/${id}/sm`),
        await moderate(actor, id, { action: 'approve', version: 1 }),
      ]) {
        expect([res.status, res.body.error.code]).toEqual([403, code]);
      }
    }
  });
});

describe('aislamiento', () => {
  it('con su tienda en la ruta, no llega a los productos ni fotos de otra', async () => {
    const [a, b] = [await approvedStore(t, admin), await approvedStore(t, admin)];
    const product = await draft(b);
    const base = `/api/stores/${a.id}`;
    const attempts = [
      await a.owner.get(`${base}/products/${product.id}`),
      await a.owner.patch(`${base}/products/${product.id}`, { version: product.version, product: input(a.id) }),
      await a.owner.post(`${base}/products/${product.id}/submit`),
      await a.owner.post(`${base}/products/${product.id}/archive`),
      await a.owner.upload(`${base}/products/${product.id}/media`, await jpeg(), 'image/jpeg'),
      await a.owner.get(`${base}/media/${product.imageId}/sm`),
      await a.owner.patch(`${base}/media/${product.imageId}`, { alt: 'x' }),
      await a.owner.delete(`${base}/media/${product.imageId}`),
      await a.owner.get(`/api/stores/${b.id}/products`),
      await a.owner.get(`/api/stores/${b.id}/products/${product.id}`),
      await a.owner.post(`/api/stores/${b.id}/products`, input(b.id)),
      await a.owner.get(`/api/stores/${b.id}/media/${product.imageId}/sm`),
    ];
    expect(attempts.map((res) => res.status)).toEqual(attempts.map(() => 404));
    expect(await read(b, product.id)).toMatchObject({ title: 'Juego de tienda', status: 'DRAFT' });
  });

  it('la lista solo trae lo propio', async () => {
    const [a, b] = [await approvedStore(t, admin), await approvedStore(t, admin)];
    const mine = await draft(a);
    await draft(b);
    const { body } = await a.owner.get(`/api/stores/${a.id}/products`);
    expect(body.items.map((item: { id: string }) => item.id)).toEqual([mine.id]);
    expect(body.total).toBe(1);
  });
});

describe('suspensión', () => {
  it('oculta lo publicado, congela el panel y al restituir vuelve igual', async () => {
    const shop = await approvedStore(t, admin);
    const product = await published(shop, { title: 'Se oculta' });
    expect((await visitor.get(`/api/media/${product.imageId}/sm`)).status).toBe(200);
    await decide(admin, shop.id, 'suspend', 'Denuncias');
    expect(await visible(product.slug)).toBe(false);
    expect((await visitor.get(`/api/media/${product.imageId}/sm`)).status).toBe(404);

    const base = `/api/stores/${shop.id}`;
    const writes = [
      await shop.owner.post(`${base}/products`, input(shop.id)),
      await shop.owner.patch(`${base}/products/${product.id}`, { version: 99, product: input(shop.id) }),
      await shop.owner.post(`${base}/products/${product.id}/submit`),
      await shop.owner.post(`${base}/products/${product.id}/archive`),
      await shop.owner.upload(`${base}/products/${product.id}/media`, await jpeg(), 'image/jpeg'),
      await shop.owner.patch(`${base}/media/${product.imageId}`, { alt: 'x' }),
      await shop.owner.delete(`${base}/media/${product.imageId}`),
    ];
    expect(writes.map((res) => [res.status, res.body.error?.code])).toEqual(writes.map(() => [409, 'STORE_NOT_APPROVED']));
    expect((await shop.owner.get(`${base}/products`)).status).toBe(200);

    await decide(admin, shop.id, 'reinstate', 'Aclarado');
    expect(await visible(product.slug)).toBe(true);
  });

  it('lo pendiente de una tienda suspendida no se puede aprobar', async () => {
    const shop = await approvedStore(t, admin);
    const product = await draft(shop);
    const sent = await shop.owner.post(`/api/stores/${shop.id}/products/${product.id}/submit`);
    await decide(admin, shop.id, 'suspend', 'Denuncias');
    const res = await moderate(moderator, product.id, { action: 'approve', version: sent.body.version });
    expect([res.status, res.body.error.code]).toEqual([422, 'STORE_SUSPENDED']);
  });

  it('una solicitud sin aprobar todavía no crea productos', async () => {
    const owner = await t.signedIn('customer', true);
    const id = await readyStore(owner);
    expect((await owner.post(`/api/stores/${id}/products`, input(id))).body.error.code).toBe('STORE_NOT_APPROVED');
  });
});
