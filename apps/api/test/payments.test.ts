import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExpirySweep } from '../src/modules/reservations/expiry-sweep.js';
import { createTestDatabase, type TestDatabase } from './support/database.js';
import { startIdentity, type Browser, type TestIdentity } from './support/identity.js';
import { act, approve, listing, openShop, pay, reserved, type Shop } from './support/reservations.js';

let db: TestDatabase;
let t: TestIdentity;
let admin: Browser;
let shop: Shop;

beforeAll(async () => {
  db = await createTestDatabase();
  t = await startIdentity(db.appUrl);
  admin = await t.signedIn('admin');
  shop = await openShop(t, admin);
}, 90_000);

afterAll(async () => {
  await t?.stop();
  await db?.stop();
}, 30_000);

/** Reserva aprobada a la espera de un depósito de 2000 sobre 10000. */
async function awaiting(): Promise<{ person: Browser; id: string; version: number }> {
  const person = await t.signedIn('customer');
  const { body } = await approve(shop, await reserved(person, await listing(admin, shop, { depositMinor: 2000 })));
  expect(body.status).toBe('AWAITING_DEPOSIT');
  return { person, id: body.id, version: body.version };
}

const reverse = (id: string, paymentId: string, reason = 'Me equivoqué de reserva') =>
  shop.owner.post(`/api/stores/${shop.id}/reservations/${id}/payments/${paymentId}/reverse`, { reason });

describe('anotar dinero', () => {
  it('el depósito completo confirma la reserva; uno parcial, no', async () => {
    const { id, person } = await awaiting();
    const partial = await pay(shop, id, 'DEPOSIT', 500);
    expect(partial.status, JSON.stringify(partial.body)).toBe(201);
    expect(partial.body).toMatchObject({ status: 'AWAITING_DEPOSIT', paid: { deposit: 500, net: 500 } });
    const full = await pay(shop, id, 'DEPOSIT', 1500);
    expect(full.body).toMatchObject({ status: 'CONFIRMED', paid: { deposit: 2000 } });
    expect(full.body.events[0]).toMatchObject({ action: 'confirm', actor: 'STORE' });
    const seen = (await person.get(`/api/reservations/${id}`)).body;
    expect(seen.payments).toHaveLength(2);
    expect(JSON.stringify(seen)).not.toContain('recordedBy');
  });

  it.each([
    ['más que el depósito', 'DEPOSIT', 2001, 422, 'DEPOSIT_EXCEEDED'],
    ['saldo antes de confirmar', 'BALANCE', 100, 422, 'NOT_PAYABLE'],
    ['devolver sin haber recibido', 'REFUND', 1, 422, 'REFUND_EXCEEDED'],
    ['importe cero', 'DEPOSIT', 0, 400, 'VALIDATION_ERROR'],
    ['importe con decimales', 'DEPOSIT', 1.5, 400, 'VALIDATION_ERROR'],
  ])('rechaza %s', async (_name, kind, amount, status, code) => {
    const { id } = await awaiting();
    const res = await pay(shop, id, kind, amount);
    expect([res.status, res.body.error.code]).toEqual([status, code]);
  });

  it('entre depósito y saldo nunca se supera el precio', async () => {
    const { id } = await awaiting();
    await pay(shop, id, 'DEPOSIT', 2000);
    expect((await pay(shop, id, 'BALANCE', 8001)).body.error.code).toBe('PRICE_EXCEEDED');
    expect((await pay(shop, id, 'BALANCE', 8000)).body.paid.net).toBe(10_000);
  });

  it('dos anotaciones a la vez no superan el depósito', async () => {
    const { id } = await awaiting();
    const results = await Promise.all([pay(shop, id, 'DEPOSIT', 2000), pay(shop, id, 'DEPOSIT', 2000)]);
    expect(results.map((res) => res.status).toSorted()).toEqual([201, 422]);
  });

  it.each([{ reference: '4111 1111 1111 1111' }, { note: 'tarjeta 5500-0000-0000-0004' }])('no guarda números de tarjeta: %j', async (patch) => {
    const { id } = await awaiting();
    const res = await pay(shop, id, 'DEPOSIT', 100, patch);
    expect([res.status, res.body.error.code]).toEqual([422, 'CARD_NUMBER']);
    expect(await t.prisma.paymentRecord.count({ where: { reservationId: id } })).toBe(0);
  });

  it('un depósito parcial impide que la reserva venza sola', async () => {
    const { id } = await awaiting();
    await pay(shop, id, 'DEPOSIT', 500);
    await t.prisma.reservation.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await t.app.get(ExpirySweep).run(new Date());
    expect((await t.prisma.reservation.findUniqueOrThrow({ where: { id } })).status).toBe('AWAITING_DEPOSIT');
  });

  it('nadie anota pagos en su propia reserva', async () => {
    const own = await openShop(t, admin);
    const reservation = await reserved(own.owner, await listing(admin, own, { depositMinor: 100 }));
    expect((await pay(own, reservation.id, 'DEPOSIT', 100)).body.error.code).toBe('OWN_RESERVATION');
  });

  it('otra tienda no llega a los pagos', async () => {
    const { id } = await awaiting();
    const { body } = await pay(shop, id, 'DEPOSIT', 100);
    const other = await openShop(t, admin);
    expect((await pay(other, id, 'DEPOSIT', 100)).status).toBe(404);
    const res = await other.owner.post(`/api/stores/${other.id}/reservations/${id}/payments/${body.payments[0].id}/reverse`, { reason: 'motivo' });
    expect(res.status).toBe(404);
  });
});

describe('corregir', () => {
  it('un reverso anula el movimiento sin borrarlo, una sola vez', async () => {
    const { id } = await awaiting();
    const { body } = await pay(shop, id, 'DEPOSIT', 500);
    const paymentId = body.payments[0].id;
    const results = await Promise.all([reverse(id, paymentId), reverse(id, paymentId)]);
    expect(results.map((res) => res.status).toSorted()).toEqual([201, 409]);
    const after = results.find((res) => res.status === 201)?.body;
    expect(after.paid).toEqual({ deposit: 0, net: 0 });
    expect(after.payments).toHaveLength(2);
    expect(after.payments.find((item: { id: string }) => item.id === paymentId).reversed).toBe(true);
  });

  it('no se reversa un reverso', async () => {
    const { id } = await awaiting();
    const { body } = await pay(shop, id, 'DEPOSIT', 500);
    const { body: after } = await reverse(id, body.payments[0].id);
    const reversal = after.payments.find((item: { reversesId: string | null }) => item.reversesId !== null);
    const res = await reverse(id, reversal.id);
    expect([res.status, res.body.error.code]).toEqual([422, 'NOT_REVERSIBLE']);
  });

  it('no se reversa un cobro que ya se devolvió', async () => {
    const { id } = await awaiting();
    const { body } = await pay(shop, id, 'DEPOSIT', 500);
    await pay(shop, id, 'REFUND', 500);
    const res = await reverse(id, body.payments[0].id);
    expect([res.status, res.body.error.code]).toEqual([422, 'REFUND_EXCEEDED']);
  });

  it('exige motivo y tampoco admite tarjetas en él', async () => {
    const { id } = await awaiting();
    const { body } = await pay(shop, id, 'DEPOSIT', 500);
    expect((await reverse(id, body.payments[0].id, '')).status).toBe(400);
    expect((await reverse(id, body.payments[0].id, '4111111111111111')).body.error.code).toBe('CARD_NUMBER');
  });
});

describe('devolución pendiente', () => {
  it('aparece al cancelar con dinero recibido y desaparece al devolverlo', async () => {
    const { id, person } = await awaiting();
    const { body } = await pay(shop, id, 'DEPOSIT', 2000);
    const cancelled = await act(shop, body, { action: 'cancel', reason: 'El proveedor falló' });
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', refundPending: true });
    expect((await person.get('/api/reservations')).body.items[0].refundPending).toBe(true);
    const list = (await shop.owner.get(`/api/stores/${shop.id}/reservations?refund=pending`)).body.items;
    expect(list.map((item: { id: string }) => item.id)).toContain(id);
    await pay(shop, id, 'REFUND', 500);
    expect((await person.get(`/api/reservations/${id}`)).body.refundPending).toBe(true);
    const done = await pay(shop, id, 'REFUND', 1500);
    expect(done.body).toMatchObject({ refundPending: false, paid: { net: 0 } });
    expect((await pay(shop, id, 'REFUND', 1)).body.error.code).toBe('REFUND_EXCEEDED');
  });

  it('cada anotación queda en la auditoría', async () => {
    const { id } = await awaiting();
    const { body } = await pay(shop, id, 'DEPOSIT', 500);
    await reverse(id, body.payments[0].id);
    const actions = (await t.prisma.auditEvent.findMany({ where: { targetId: id } })).map(({ action }) => action);
    expect(actions).toEqual(expect.arrayContaining(['reservation.payment_recorded', 'reservation.payment_reversed']));
  });
});
