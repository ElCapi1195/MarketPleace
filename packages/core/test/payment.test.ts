import { describe, expect, it } from 'vitest';
import { containsCardNumber, paymentProblem, summarizePayments, type PaymentEntry } from '../src/index.js';

const entry = (kind: PaymentEntry['kind'], amountMinor: number): PaymentEntry => ({ kind, amountMinor });

describe('summarizePayments', () => {
  it('suma cobros, resta devoluciones y aplica los reversos', () => {
    const entries = [entry('DEPOSIT', 100), entry('BALANCE', 400), entry('REFUND', 50), entry('BALANCE', -400), entry('REFUND', -50)];
    expect(summarizePayments(entries)).toEqual({ deposit: 100, received: 100, refunded: 0, net: 100 });
  });

  it('sin registros es cero', () => {
    expect(summarizePayments([])).toEqual({ deposit: 0, received: 0, refunded: 0, net: 0 });
  });
});

describe('paymentProblem', () => {
  const context = { status: 'CONFIRMED', priceMinor: 1000, depositMinor: 200, summary: summarizePayments([entry('DEPOSIT', 200)]) };

  it.each([
    ['DEPOSIT', 1, 'DEPOSIT_EXCEEDED'],
    ['BALANCE', 800, null],
    ['BALANCE', 801, 'PRICE_EXCEEDED'],
    ['REFUND', 200, null],
    ['REFUND', 201, 'REFUND_EXCEEDED'],
    ['BALANCE', 0, 'INVALID_AMOUNT'],
    ['BALANCE', -5, 'INVALID_AMOUNT'],
    ['BALANCE', 1.5, 'INVALID_AMOUNT'],
  ] as const)('%s de %i', (kind, amount, expected) => {
    expect(paymentProblem(kind, amount, context)).toBe(expected);
  });

  it('no se cobra antes de aprobar ni después de cerrar, pero sí se devuelve', () => {
    for (const status of ['PENDING_REVIEW', 'AWAITING_CUSTOMER', 'REJECTED', 'CANCELLED', 'EXPIRED', 'NO_SHOW']) {
      expect(paymentProblem('BALANCE', 1, { ...context, status })).toBe('NOT_PAYABLE');
      expect(paymentProblem('REFUND', 1, { ...context, status })).toBeNull();
    }
  });

  it('el depósito solo se anota mientras se espera o después, no al completarse', () => {
    const empty = { ...context, summary: summarizePayments([]) };
    expect(paymentProblem('DEPOSIT', 200, { ...empty, status: 'AWAITING_DEPOSIT' })).toBeNull();
    expect(paymentProblem('BALANCE', 1, { ...empty, status: 'AWAITING_DEPOSIT' })).toBe('NOT_PAYABLE');
    expect(paymentProblem('BALANCE', 1, { ...empty, status: 'COMPLETED' })).toBeNull();
  });
});

describe('containsCardNumber', () => {
  it.each(['4111111111111111', 'pago 4111 1111 1111 1111 ok', '5500-0000-0000-0004', '378282246310005'])('detecta %j', (text) => {
    expect(containsCardNumber(text)).toBe(true);
  });

  it.each(['', 'Transferencia 20261125-001', '1234567890123456', 'Folio 99887766', '+1 555 010 0199'])('permite %j', (text) => {
    expect(containsCardNumber(text)).toBe(false);
  });
});
