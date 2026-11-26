import { randomUUID } from 'node:crypto';
import { MAX_DOCUMENT_BYTES } from '@marketplace/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { jpeg, png } from './support/files.js';
import { startIdentity, type Browser, type TestIdentity } from './support/identity.js';
import { application, approvedStore, decide, readyStore, REQUIRED_DOCUMENTS } from './support/stores.js';

const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

let db: TestDatabase;
let t: TestIdentity;
let admin: Browser;
let moderator: Browser;
let owner: Browser;

beforeAll(async () => {
  db = await createTestDatabase();
  t = await startIdentity(db.appUrl);
  [admin, moderator, owner] = [await t.signedIn('admin'), await t.signedIn('moderator'), await t.signedIn('customer', true)];
}, 90_000);

afterAll(async () => {
  await t?.stop();
  await db?.stop();
}, 30_000);

describe('solicitud', () => {
  it('exige sesión y segundo paso', async () => {
    expect((await t.browser().post('/api/stores', application())).status).toBe(401);
    const res = await (await t.signedIn('customer')).post('/api/stores', application());
    expect([res.status, res.body.error.code]).toEqual([403, 'TWO_FACTOR_REQUIRED']);
  });

  it('nace como borrador y quien la crea es su propietario', async () => {
    const res = await owner.post('/api/stores', application({ name: 'Propia' }));
    expect(res.body).toMatchObject({ name: 'Propia', status: 'DRAFT', role: 'OWNER', documents: [], events: [] });
    const mine = await owner.get('/api/stores/mine');
    expect(mine.body).toContainEqual(expect.objectContaining({ id: res.body.id, status: 'DRAFT', role: 'OWNER' }));
  });

  it('se corrige mientras es borrador', async () => {
    const { body } = await owner.post('/api/stores', application({ legalName: '' }));
    const res = await owner.patch(`/api/stores/${body.id}`, application({ name: 'Corregida' }));
    expect(res.body).toMatchObject({ name: 'Corregida', legalName: 'Ana S. A.' });
  });

  it('no se envía incompleta: dice qué falta', async () => {
    const other = await t.signedIn('customer', true);
    const { body } = await other.post('/api/stores', application({ taxId: '' }));
    const res = await other.post(`/api/stores/${body.id}/submit`);
    expect([res.status, res.body.error.code]).toEqual([422, 'INCOMPLETE']);
    expect(res.body.error.message).toContain('Registro comercial');
    expect(res.body.error.message).toContain('identificación fiscal');
  });

  it('limita las solicitudes abiertas por persona', async () => {
    const other = await t.signedIn('customer', true);
    for (let index = 0; index < 3; index += 1) expect((await other.post('/api/stores', application())).status).toBe(201);
    const res = await other.post('/api/stores', application());
    expect([res.status, res.body.error.code]).toEqual([409, 'TOO_MANY_APPLICATIONS']);
  });
});

describe('documentos', () => {
  let applicant: Browser;
  let id: string;
  const url = (key: string) => `/api/stores/${id}/documents/${key}`;

  beforeAll(async () => {
    applicant = await t.signedIn('customer', true);
    id = (await applicant.post('/api/stores', application())).body.id;
  });

  it('acepta imágenes, recodificadas, y PDF', async () => {
    const image = await applicant.upload(url('identidad-responsable'), await jpeg(), 'image/jpeg');
    expect(image.body).toMatchObject({ key: 'identidad-responsable', type: 'image/webp' });
    const pdf = await applicant.upload(url('registro-comercial'), PDF, 'application/pdf');
    expect(pdf.body).toMatchObject({ key: 'registro-comercial', type: 'application/pdf' });
    expect([...t.documents.files.values()].some((data) => data.includes('SECRETO-EXIF'))).toBe(false);
  });

  it('subir otro sustituye al anterior y borra su archivo', async () => {
    const first = (await applicant.upload(url('registro-comercial'), PDF, 'application/pdf')).body.id;
    const second = (await applicant.upload(url('registro-comercial'), PDF, 'application/pdf')).body.id;
    expect(t.documents.files.has(`${first}/doc`)).toBe(false);
    expect(t.documents.files.has(`${second}/doc`)).toBe(true);
  });

  it.each([
    ['HTML como PDF', Buffer.from('<html><script>alert(1)</script>%PDF-1.7 %%EOF'), 'application/pdf', 415, 'UNSUPPORTED_DOCUMENT'],
    ['PDF con JavaScript', Buffer.from('%PDF-1.7\n<</S/JavaScript/JS(app.alert(1))>>\n%%EOF'), 'application/pdf', 415, 'UNSUPPORTED_DOCUMENT'],
    ['PDF truncado', Buffer.from('%PDF-1.7\n1 0 obj'), 'application/pdf', 415, 'UNSUPPORTED_DOCUMENT'],
    ['imagen falsa', Buffer.from('no soy una imagen de verdad'), 'image/png', 415, 'UNSUPPORTED_IMAGE'],
    ['Word', Buffer.from('PK'), 'application/msword', 415, 'UNSUPPORTED_MEDIA_TYPE'],
    ['enorme', Buffer.alloc(MAX_DOCUMENT_BYTES + 1), 'application/pdf', 413, 'FILE_TOO_LARGE'],
  ])('rechaza %s y no guarda nada', async (_name, body, type, status, code) => {
    const before = t.documents.files.size;
    const res = await applicant.upload(url('comprobante-domicilio'), body, type);
    expect([res.status, res.body.error.code]).toEqual([status, code]);
    expect(t.documents.files.size).toBe(before);
  });

  it('solo admite los documentos que pide el nicho', async () => {
    for (const key of ['otro', 'constructor', '..%2F..']) {
      expect((await applicant.upload(url(key), PDF, 'application/pdf')).status).toBe(404);
    }
  });

  it('se descarga siempre como archivo adjunto y sin caché', async () => {
    const { body } = await applicant.upload(url('registro-comercial'), PDF, 'application/pdf');
    const res = await applicant.get(`/api/stores/${id}/documents/${body.id}`);
    expect(res.status).toBe(200);
    expect(res.headers).toMatchObject({
      'content-disposition': 'attachment; filename="registro-comercial.pdf"',
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    });
  });

  it('una vez enviada no se tocan', async () => {
    const other = await t.signedIn('customer', true);
    const sent = await readyStore(other);
    const { body } = await other.get(`/api/stores/${sent}`);
    expect((await other.post(`/api/stores/${sent}/submit`)).body.status).toBe('SUBMITTED');
    const upload = await other.upload(`/api/stores/${sent}/documents/${REQUIRED_DOCUMENTS[0]}`, PDF, 'application/pdf');
    const remove = await other.delete(`/api/stores/${sent}/documents/${body.documents[0].id}`);
    const edit = await other.patch(`/api/stores/${sent}`, application({ name: 'Cambiada' }));
    for (const res of [upload, remove, edit]) expect([res.status, res.body.error.code]).toEqual([409, 'NOT_EDITABLE']);
  });
});

describe('verificación', () => {
  it('recorre el ciclo: pedir datos, corregir, aprobar, suspender y restituir', async () => {
    const applicant = await t.signedIn('customer', true);
    const id = await readyStore(applicant);
    await applicant.post(`/api/stores/${id}/submit`);
    expect((await decide(moderator, id, 'start_review')).body.status).toBe('IN_REVIEW');
    expect((await decide(moderator, id, 'request_info', 'Falta el sello')).body.status).toBe('NEEDS_INFO');

    const seen = (await applicant.get(`/api/stores/${id}`)).body;
    expect(seen.events[0]).toMatchObject({ action: 'request_info', reason: 'Falta el sello' });
    expect(JSON.stringify(seen)).not.toContain('actorId');

    expect((await applicant.patch(`/api/stores/${id}`, application({ phone: '2' }))).status).toBe(200);
    await applicant.post(`/api/stores/${id}/submit`);
    await decide(moderator, id, 'start_review');
    expect((await decide(moderator, id, 'approve')).body.status).toBe('APPROVED');

    const forbidden = await decide(moderator, id, 'suspend', 'motivo');
    expect([forbidden.status, forbidden.body.error.code]).toEqual([403, 'FORBIDDEN']);
    expect((await decide(admin, id, 'suspend', 'Denuncias')).body.status).toBe('SUSPENDED');
    expect((await decide(admin, id, 'reinstate', 'Aclarado')).body.status).toBe('APPROVED');
  });

  it.each(['request_info', 'reject'])('%s exige motivo', async (action) => {
    const applicant = await t.signedIn('customer', true);
    const id = await readyStore(applicant);
    await applicant.post(`/api/stores/${id}/submit`);
    await decide(moderator, id, 'start_review');
    const res = await decide(moderator, id, action, '  ');
    expect([res.status, res.body.error.code]).toEqual([422, 'REASON_REQUIRED']);
  });

  it('no salta pasos', async () => {
    const applicant = await t.signedIn('customer', true);
    const id = await readyStore(applicant);
    await applicant.post(`/api/stores/${id}/submit`);
    const res = await decide(admin, id, 'approve');
    expect([res.status, res.body.error.code]).toEqual([409, 'INVALID_TRANSITION']);
  });

  it('un borrador sin enviar no está al alcance de quien revisa', async () => {
    const applicant = await t.signedIn('customer', true);
    const id = await readyStore(applicant);
    const { body } = await applicant.get(`/api/stores/${id}`);
    for (const res of [
      await admin.get(`/api/admin/store-reviews/${id}`),
      await decide(admin, id, 'start_review'),
      await admin.get(`/api/admin/store-reviews/${id}/documents/${body.documents[0].id}`),
    ]) {
      expect(res.status).toBe(404);
    }
    const list = (await admin.get('/api/admin/store-reviews?status=DRAFT')).body.items;
    expect(list).toEqual([]);
  });

  it('si dos personas deciden a la vez, solo vale una decisión', async () => {
    const applicant = await t.signedIn('customer', true);
    const id = await readyStore(applicant);
    await applicant.post(`/api/stores/${id}/submit`);
    await decide(moderator, id, 'start_review');
    const results = await Promise.all([decide(moderator, id, 'approve'), decide(admin, id, 'reject', 'No')]);
    expect(results.map((res) => res.status).toSorted()).toEqual([200, 409]);
    expect(await t.prisma.storeEvent.count({ where: { storeId: id, action: { in: ['approve', 'reject'] } } })).toBe(1);
  });

  it('nadie decide sobre su propia tienda', async () => {
    const reviewer = await t.signedIn('moderator');
    const id = await readyStore(reviewer);
    await reviewer.post(`/api/stores/${id}/submit`);
    for (const res of [await decide(reviewer, id, 'start_review'), await reviewer.get(`/api/admin/store-reviews/${id}`)]) {
      expect([res.status, res.body.error.code]).toEqual([403, 'OWN_STORE']);
    }
  });

  it('la lista filtra por estado y la ficha muestra lo necesario para decidir', async () => {
    const applicant = await t.signedIn('customer', true);
    const id = await readyStore(applicant, { name: 'Para revisar' });
    await applicant.post(`/api/stores/${id}/submit`);
    const list = (await moderator.get('/api/admin/store-reviews?status=SUBMITTED')).body.items;
    expect(list.map((item: { id: string }) => item.id)).toContain(id);
    expect(list.every((item: { status: string }) => item.status === 'SUBMITTED')).toBe(true);
    const { body } = await moderator.get(`/api/admin/store-reviews/${id}`);
    expect(body).toMatchObject({ legalName: 'Ana S. A.', documents: [expect.anything(), expect.anything()], owners: [{ name: 'Persona' }] });
  });

  it('cada lectura de un documento queda registrada', async () => {
    const applicant = await t.signedIn('customer', true);
    const id = await readyStore(applicant);
    await applicant.post(`/api/stores/${id}/submit`);
    const { body } = await moderator.get(`/api/admin/store-reviews/${id}`);
    const res = await moderator.get(`/api/admin/store-reviews/${id}/documents/${body.documents[0].id}`);
    expect([res.status, res.headers['content-disposition']]).toEqual([200, expect.stringContaining('attachment')]);
    expect(await t.prisma.auditEvent.count({ where: { action: 'store.document_viewed', targetId: id } })).toBe(1);
  });

  it('avisa por correo al propietario de cada decisión, sin datos privados', async () => {
    const applicant = await t.signedIn('customer', true);
    const id = await readyStore(applicant, { name: 'Con aviso', taxId: 'PRIVADO-9' });
    const { email } = (await applicant.get('/api/me')).body;
    await applicant.post(`/api/stores/${id}/submit`);
    await decide(moderator, id, 'start_review');
    await decide(moderator, id, 'reject', 'Documento ilegible');
    const mail = t.mailer.sent.findLast((item) => item.to === email);
    expect(mail?.text).toContain('Documento ilegible');
    expect(mail?.text).not.toContain('PRIVADO-9');
  });

  it('cliente y moderador sin 2FA no acceden a las revisiones', async () => {
    const id = randomUUID();
    for (const [actor, code] of [
      [await t.signedIn('customer', true), 'FORBIDDEN'],
      [await t.signedIn('moderator', false), 'TWO_FACTOR_REQUIRED'],
    ] as const) {
      for (const res of [
        await actor.get('/api/admin/store-reviews'),
        await actor.get(`/api/admin/store-reviews/${id}`),
        await decide(actor, id, 'approve'),
        await actor.get(`/api/admin/store-reviews/${id}/documents/${id}`),
      ]) {
        expect([res.status, res.body.error.code]).toEqual([403, code]);
      }
    }
  });
});

describe('una tienda no ve a otra', () => {
  it('toda ruta ajena responde 404', async () => {
    const a = await approvedStore(t, moderator, { name: 'Tienda A' });
    const b = await approvedStore(t, moderator, { name: 'Tienda B' });
    const document = (await b.owner.get(`/api/stores/${b.id}`)).body.documents[0].id;
    const attempts = [
      await a.owner.get(`/api/stores/${b.id}`),
      await a.owner.patch(`/api/stores/${b.id}`, application()),
      await a.owner.post(`/api/stores/${b.id}/submit`),
      await a.owner.get(`/api/stores/${b.id}/documents/${document}`),
      await a.owner.delete(`/api/stores/${b.id}/documents/${document}`),
      await a.owner.upload(`/api/stores/${b.id}/documents/registro-comercial`, await png(), 'image/png'),
      // Con su propia tienda en la ruta y el id del documento ajeno.
      await a.owner.get(`/api/stores/${a.id}/documents/${document}`),
      await moderator.get(`/api/admin/store-reviews/${a.id}/documents/${document}`),
    ];
    expect(attempts.map((res) => res.status)).toEqual(attempts.map(() => 404));
  });

  it('ni siquiera el administrador entra en el panel de una tienda sin ser miembro', async () => {
    const { id } = await approvedStore(t, moderator);
    expect((await admin.get(`/api/stores/${id}`)).status).toBe(404);
    expect((await admin.get('/api/stores/no-es-un-id')).status).toBe(404);
  });

  it('un miembro sin segundo paso queda fuera', async () => {
    const { owner: person, id } = await approvedStore(t, moderator);
    const me = (await person.get('/api/me')).body;
    await t.prisma.user.update({ where: { id: me.id }, data: { twoFactorEnabled: false } });
    const res = await person.get(`/api/stores/${id}`);
    expect([res.status, res.body.error.code]).toEqual([403, 'TWO_FACTOR_REQUIRED']);
  });
});
