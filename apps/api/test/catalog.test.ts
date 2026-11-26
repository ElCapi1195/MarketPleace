import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { jpeg } from './support/files.js';
import { startIdentity, type Browser, type TestIdentity } from './support/identity.js';

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
  storeId = (await admin.post('/api/admin/stores', { name: 'Tienda Única' })).body.id;
}, 90_000);

afterAll(async () => {
  await t?.stop();
  await db?.stop();
}, 30_000);

const input = (patch: object = {}) => ({
  storeId,
  title: 'Mando de prueba',
  description: 'Descripción',
  categorySlug: 'mandos',
  kind: 'IN_STOCK',
  priceMinor: 7900,
  depositMinor: 0,
  units: 4,
  availableOn: null,
  attributes: { platform: 'pc', condition: 'nuevo' },
  featured: false,
  ...patch,
});

async function draft(patch: object = {}) {
  const res = await admin.post('/api/admin/products', input(patch));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
}

async function published(patch: object = {}) {
  const product = await draft(patch);
  await admin.upload(`/api/admin/products/${product.id}/media`, await jpeg(), 'image/jpeg');
  const res = await admin.post(`/api/admin/products/${product.id}/publish`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}

const titles = async (query: string) =>
  (await visitor.get(`/api/catalog/products?${query}`)).body.items.map((item: { title: string }) => item.title);

describe('acceso a la administración', () => {
  const id = randomUUID();
  const routes: ['get' | 'post' | 'patch' | 'delete', string][] = [
    ['get', '/api/admin/stores'],
    ['post', '/api/admin/stores'],
    ['get', '/api/admin/products'],
    ['post', '/api/admin/products'],
    ['get', `/api/admin/products/${id}`],
    ['patch', `/api/admin/products/${id}`],
    ['post', `/api/admin/products/${id}/publish`],
    ['post', `/api/admin/products/${id}/archive`],
    ['post', `/api/admin/products/${id}/media`],
    ['patch', `/api/admin/media/${id}`],
    ['delete', `/api/admin/media/${id}`],
    ['get', `/api/admin/media/${id}/sm`],
  ];

  it('deniega a quien no es administrador con 2FA', async () => {
    const actors: [Browser, number, string][] = [
      [t.browser(), 401, 'UNAUTHORIZED'],
      [await t.signedIn('customer'), 403, 'FORBIDDEN'],
      [await t.signedIn('moderator'), 403, 'FORBIDDEN'],
      [await t.signedIn('admin', false), 403, 'TWO_FACTOR_REQUIRED'],
    ];
    for (const [browser, status, code] of actors) {
      for (const [method, url] of routes) {
        const res = await browser.send(method, url, method === 'get' ? undefined : {});
        expect([url, res.status, res.body.error.code]).toEqual([url, status, code]);
      }
    }
  }, 30_000);
});

describe('productos', () => {
  it('nace como borrador, invisible para el público', async () => {
    const product = await draft({ title: 'Borrador secreto' });
    expect(product).toMatchObject({ status: 'DRAFT', version: 1, slug: 'borrador-secreto', media: [] });
    expect((await visitor.get(`/api/catalog/products/${product.slug}`)).status).toBe(404);
    expect(await titles('q=secreto')).toEqual([]);
  });

  it('dos productos con el mismo título tienen direcciones distintas', async () => {
    const [a, b] = [await draft({ title: 'Título repetido' }), await draft({ title: 'Título repetido' })];
    expect(a.slug).not.toBe(b.slug);
    expect(b.slug).toMatch(/^titulo-repetido-[a-z0-9]+$/);
  });

  it.each([
    ['categoría inexistente', { categorySlug: 'no-existe' }],
    ['atributo desconocido', { attributes: { platform: 'pc', condition: 'nuevo', otro: 'x' } }],
    ['atributo obligatorio ausente', { attributes: { platform: 'pc' } }],
    ['opción inexistente', { attributes: { platform: 'tostadora', condition: 'nuevo' } }],
    ['número como texto', { categorySlug: 'consolas', attributes: { platform: 'pc', condition: 'nuevo', storageGb: '1' } }],
    ['clave heredada', { attributes: { platform: 'pc', condition: 'nuevo', constructor: 'x' } }],
    ['tienda inexistente', { storeId: randomUUID() }],
  ])('rechaza %s', async (_name, patch) => {
    const res = await admin.post('/api/admin/products', input(patch));
    expect([res.status, res.body.error.code]).toEqual([400, 'VALIDATION_ERROR']);
  });

  it('no se publica sin foto', async () => {
    const { id } = await draft();
    const res = await admin.post(`/api/admin/products/${id}/publish`);
    expect([res.status, res.body.error.code]).toEqual([422, 'IMAGE_REQUIRED']);
  });

  it('al archivarlo desaparece, y se puede volver a publicar', async () => {
    const { id, slug } = await published({ title: 'Va y viene' });
    expect((await visitor.get(`/api/catalog/products/${slug}`)).status).toBe(200);
    expect((await admin.post(`/api/admin/products/${id}/archive`)).body.status).toBe('ARCHIVED');
    expect((await visitor.get(`/api/catalog/products/${slug}`)).status).toBe(404);
    expect((await admin.post(`/api/admin/products/${id}/publish`)).body.status).toBe('PUBLISHED');
  });

  it('editar con una versión antigua no pisa el cambio de otra persona', async () => {
    const { id, version } = await draft();
    const first = await admin.patch(`/api/admin/products/${id}`, { version, product: input({ priceMinor: 100 }) });
    expect(first.body).toMatchObject({ priceMinor: 100, version: version + 1 });
    const second = await admin.patch(`/api/admin/products/${id}`, { version, product: input({ priceMinor: 200 }) });
    expect([second.status, second.body.error.code]).toEqual([409, 'VERSION_CONFLICT']);
  });

  it('cambiar el título no rompe los enlaces ya compartidos, pero sí la búsqueda', async () => {
    const { id, slug, version } = await published({ title: 'Nombre viejo' });
    await admin.patch(`/api/admin/products/${id}`, { version, product: input({ title: 'Nombre nuevo' }) });
    expect((await visitor.get(`/api/catalog/products/${slug}`)).body.title).toBe('Nombre nuevo');
    expect(await titles('q=viejo')).toEqual([]);
  });

  it('un id que no existe o no es válido da 404', async () => {
    expect((await admin.get(`/api/admin/products/${randomUUID()}`)).status).toBe(404);
    expect((await admin.get('/api/admin/products/no-es-un-id')).status).toBe(404);
  });

  it('cada cambio queda en la auditoría con su autor', async () => {
    const { id } = await published();
    await admin.post(`/api/admin/products/${id}/archive`);
    const events = await t.prisma.auditEvent.findMany({ where: { targetId: id }, orderBy: { id: 'asc' } });
    expect(events.map((event) => event.action)).toEqual(['product.created', 'media.added', 'product.published', 'product.archived']);
    expect(events.every((event) => event.actorId !== null && event.requestId !== null)).toBe(true);
  });

  it('una tienda suspendida deja de verse y no puede publicar', async () => {
    const store = (await admin.post('/api/admin/stores', { name: 'Tienda Breve' })).body;
    const { id, slug } = await published({ storeId: store.id, title: 'De tienda breve' });
    await t.prisma.store.update({ where: { id: store.id }, data: { status: 'SUSPENDED' } });
    expect((await visitor.get(`/api/catalog/products/${slug}`)).status).toBe(404);
    expect(await titles('q=tienda+breve')).toEqual([]);
    await admin.post(`/api/admin/products/${id}/archive`);
    expect((await admin.post(`/api/admin/products/${id}/publish`)).body.error.code).toBe('STORE_SUSPENDED');
  });
});

describe('catálogo público', () => {
  beforeAll(async () => {
    const common = { description: 'x' };
    await published({ ...common, title: 'Zafiro Edición Única', priceMinor: 300, categorySlug: 'mandos' });
    await published({ ...common, title: 'Zafiro Barato', priceMinor: 100, categorySlug: 'juegos' });
    await published({
      ...common,
      title: 'Zafiro Futuro',
      priceMinor: 200,
      kind: 'PREORDER',
      availableOn: '2027-02-10',
      depositMinor: 50,
      categorySlug: 'accesorios',
      featured: true,
    });
  });

  it('busca sin tildes ni mayúsculas y por el nombre de la tienda', async () => {
    expect(await titles('q=EDICION+zafiro')).toEqual(['Zafiro Edición Única']);
    expect(await titles('q=tienda+unica+zafiro+barato')).toEqual(['Zafiro Barato']);
  });

  it.each(['q=zafiro%25nada', 'q=zafiro&q=barato&page=-1', 'page=999', 'category=..%2F..', 'kind=x&sort=x'])(
    'responde con normalidad a %s',
    async (query) => {
      expect((await visitor.get(`/api/catalog/products?${query}`)).status).toBe(200);
    },
  );

  it('los comodines no encuentran productos', async () => {
    expect(await titles('q=%25')).toEqual([]);
    expect(await titles('q=___')).toEqual([]);
  });

  it('una categoría incluye sus descendientes', async () => {
    expect(await titles('q=zafiro&category=accesorios&sort=price_asc')).toEqual(['Zafiro Futuro', 'Zafiro Edición Única']);
  });

  it('una categoría desconocida no devuelve productos', async () => {
    expect(await titles('category=inventada')).toEqual([]);
  });

  it('filtra por tipo y ordena', async () => {
    expect(await titles('q=zafiro&kind=PREORDER')).toEqual(['Zafiro Futuro']);
    expect(await titles('q=zafiro&sort=price_desc')).toEqual(['Zafiro Edición Única', 'Zafiro Futuro', 'Zafiro Barato']);
    expect((await titles('q=zafiro&sort=soonest'))[0]).toBe('Zafiro Futuro');
  });

  it('pagina de doce en doce', async () => {
    const { body } = await visitor.get('/api/catalog/products?page=999');
    expect(body).toMatchObject({ items: [], page: 999, pageSize: 12 });
    expect(body.total).toBeGreaterThan(2);
  });

  it('la ficha no revela datos internos', async () => {
    const { body } = await visitor.get('/api/catalog/products/zafiro-futuro');
    expect(body).toMatchObject({ kind: 'PREORDER', availableOn: '2027-02-10', depositMinor: 50, storeName: 'Tienda Única' });
    expect(Object.keys(body)).not.toEqual(expect.arrayContaining(['createdBy']));
    for (const key of ['id', 'storeId', 'version', 'status', 'createdBy', 'searchText']) expect(body).not.toHaveProperty(key);
  });

  it('la portada reúne destacados, preventas, disponibles y categorías', async () => {
    const { body } = await visitor.get('/api/catalog/home');
    expect(body.featured[0].title).toBe('Zafiro Futuro');
    expect(body.featured).toHaveLength(3);
    expect(body.preorders.map((item: { title: string }) => item.title)).toContain('Zafiro Futuro');
    expect(body.available.every((item: { kind: string }) => item.kind === 'IN_STOCK')).toBe(true);
    const accessories = body.categories.find((item: { slug: string }) => item.slug === 'accesorios');
    expect(accessories.total).toBeGreaterThanOrEqual(2);
    expect(accessories.cover).not.toBeNull();
    expect(body.categories.some((item: { slug: string }) => item.slug === 'mandos')).toBe(false);
  });
});
