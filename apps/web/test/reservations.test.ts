import { describe, expect, it } from 'vitest';
import { deadlineText } from '../features/reservations/lib/deadline';
import { customerCan, storeActions } from '../features/reservations/lib/actions';
import { offerFrom, paymentOptions } from '../features/reservations/lib/forms';
import { customerStatus, progressOf, storeStatus } from '../features/reservations/lib/status';

const now = new Date('2026-11-25T12:00:00Z');

describe('deadlineText', () => {
  it.each([
    [null, null],
    ['2026-11-28T12:00:00Z', 'Vence en 3 días'],
    ['2026-11-26T13:00:00Z', 'Vence en 1 día'],
    ['2026-11-25T17:00:00Z', 'Vence en 5 horas'],
    ['2026-11-25T13:00:00Z', 'Vence en 1 hora'],
    ['2026-11-25T12:20:00Z', 'Vence en 20 minutos'],
    ['2026-11-25T12:00:30Z', 'Vence en 1 minuto'],
    ['2026-11-25T11:59:00Z', 'Plazo vencido'],
  ])('%j se lee %j', (expiresAt, text) => {
    expect(deadlineText(expiresAt, now)).toBe(text);
  });
});

describe('acciones', () => {
  const at = (status: Parameters<typeof storeActions>[0]['status'], expiresAt: string | null = null) =>
    storeActions({ status, expiresAt }, now).map(({ action }) => action);

  it('la tienda solo ve lo que puede hacer', () => {
    expect(at('PENDING_REVIEW')).toEqual(['approve', 'reject']);
    expect(at('AWAITING_DEPOSIT')).toEqual(['cancel']);
    expect(at('CONFIRMED')).toEqual(['start', 'ready', 'cancel']);
    expect(at('READY', '2026-11-30T00:00:00Z')).toEqual(['complete', 'cancel']);
    expect(at('READY', '2026-11-20T00:00:00Z')).toEqual(['complete', 'no_show', 'cancel']);
    expect(at('COMPLETED')).toEqual([]);
  });

  it('el cliente responde a la propuesta y cancela mientras puede', () => {
    expect(customerCan('AWAITING_CUSTOMER')).toEqual({ accept: true, decline: true, cancel: false });
    expect(customerCan('CONFIRMED')).toEqual({ accept: false, decline: false, cancel: true });
    expect(customerCan('IN_PROGRESS')).toEqual({ accept: false, decline: false, cancel: false });
  });
});

describe('progressOf', () => {
  const base = { kind: 'PREORDER' as const, depositMinor: 0 };

  it('incluye el depósito solo si lo hay y la espera solo en preventas', () => {
    expect(progressOf({ ...base, status: 'PENDING_REVIEW' })?.steps).toEqual(['Solicitada', 'Aprobada', 'En camino', 'Lista', 'Entregada']);
    expect(progressOf({ ...base, status: 'PENDING_REVIEW', depositMinor: 1 })?.steps).toContain('Depósito');
    expect(progressOf({ ...base, kind: 'SERVICE', status: 'CONFIRMED' })?.steps).toEqual(['Solicitada', 'Aprobada', 'En trabajo', 'Lista', 'Entregada']);
  });

  it('sitúa el paso en curso', () => {
    const current = (status: Parameters<typeof progressOf>[0]['status'], depositMinor = 0) => {
      const progress = progressOf({ ...base, status, depositMinor });
      return progress && progress.steps[progress.current];
    };
    expect(current('PENDING_REVIEW')).toBe('Aprobada');
    expect(current('AWAITING_DEPOSIT', 100)).toBe('Depósito');
    expect(current('CONFIRMED', 100)).toBe('En camino');
    expect(current('IN_PROGRESS')).toBe('En camino');
    expect(current('READY')).toBe('Lista');
    expect(progressOf({ ...base, status: 'CANCELLED' })).toBeNull();
  });

  it('cada estado tiene texto para ambas partes', () => {
    for (const status of ['PENDING_REVIEW', 'AWAITING_CUSTOMER', 'READY', 'EXPIRED'] as const) {
      expect(customerStatus(status).title).not.toBe('');
      expect(storeStatus(status)).not.toBe('');
    }
  });
});

describe('paymentOptions', () => {
  const base = { status: 'CONFIRMED' as const, agreed: { priceMinor: 1000, depositMinor: 200, availableOn: null }, paid: { deposit: 200, net: 200 } };

  it('propone lo que falta', () => {
    expect(paymentOptions(base)).toEqual([
      { kind: 'BALANCE', suggestedMinor: 800 },
      { kind: 'REFUND', suggestedMinor: 200 },
    ]);
    expect(paymentOptions({ ...base, status: 'AWAITING_DEPOSIT', paid: { deposit: 50, net: 50 } })).toEqual([
      { kind: 'DEPOSIT', suggestedMinor: 150 },
      { kind: 'REFUND', suggestedMinor: 50 },
    ]);
  });

  it('cerrada sin dinero no ofrece nada', () => {
    expect(paymentOptions({ ...base, status: 'CANCELLED', paid: { deposit: 0, net: 0 } })).toEqual([]);
  });
});

describe('offerFrom', () => {
  it('convierte lo escrito o explica qué falla', () => {
    expect(offerFrom({ price: '120,5', deposit: '20', availableOn: '2027-01-10' }, 'PREORDER', 'USD')).toEqual({
      ok: true,
      offer: { priceMinor: 12050, depositMinor: 2000, availableOn: '2027-01-10' },
    });
    expect(offerFrom({ price: '10', deposit: '', availableOn: '2027-01-10' }, 'IN_STOCK', 'USD')).toMatchObject({ offer: { depositMinor: 0, availableOn: null } });
    expect(offerFrom({ price: 'x', deposit: '', availableOn: '' }, 'IN_STOCK', 'USD')).toMatchObject({ ok: false });
    expect(offerFrom({ price: '10', deposit: '11', availableOn: '' }, 'IN_STOCK', 'USD')).toMatchObject({ error: 'El depósito no puede superar el precio.' });
    expect(offerFrom({ price: '10', deposit: '', availableOn: '' }, 'PREORDER', 'USD')).toMatchObject({ error: 'Una preventa necesita la fecha estimada.' });
  });
});
