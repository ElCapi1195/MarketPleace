import { describe, expect, it } from 'vitest';
import { productActions, productStatuses, productTransition, remoderates } from '../src/index.js';

const valid: Record<string, string> = {
  'DRAFT submit': 'PENDING_MODERATION',
  'REJECTED submit': 'PENDING_MODERATION',
  'ARCHIVED submit': 'PENDING_MODERATION',
  'PENDING_MODERATION approve': 'PUBLISHED',
  'PENDING_MODERATION reject': 'REJECTED',
  'DRAFT publish': 'PUBLISHED',
  'PENDING_MODERATION publish': 'PUBLISHED',
  'REJECTED publish': 'PUBLISHED',
  'ARCHIVED publish': 'PUBLISHED',
  'DRAFT archive': 'ARCHIVED',
  'PENDING_MODERATION archive': 'ARCHIVED',
  'PUBLISHED archive': 'ARCHIVED',
  'REJECTED archive': 'ARCHIVED',
  'PUBLISHED remoderate': 'PENDING_MODERATION',
};

describe('productTransition', () => {
  it.each(productStatuses.flatMap((status) => productActions.map((action) => [status, action] as const)))('%s con %s', (status, action) => {
    expect(productTransition(status, action)).toBe(valid[`${status} ${action}`] ?? null);
  });
});

describe('remoderates', () => {
  const before = { title: 'A', categorySlug: 'x', priceMinor: 100 };

  it.each([
    [{ title: 'B' }, true],
    [{ categorySlug: 'y' }, true],
    [{ priceMinor: 99 }, true],
    [{}, false],
  ])('%j con todas las reglas', (patch, expected) => {
    expect(remoderates(before, { ...before, ...patch }, ['title', 'category', 'price', 'images'])).toBe(expected);
  });

  it('solo mira lo que el nicho vigila', () => {
    expect(remoderates(before, { ...before, title: 'B', priceMinor: 1 }, ['category'])).toBe(false);
  });
});
