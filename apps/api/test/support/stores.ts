import { expect } from 'vitest';
import { png } from './files.js';
import type { Browser, TestIdentity } from './identity.js';

export const application = (patch: object = {}) => ({
  name: 'Tienda de Ana',
  about: 'Equipos revisados',
  legalName: 'Ana S. A.',
  taxId: 'ABC-123',
  phone: '+1 555 0100',
  address: 'Calle 1',
  ...patch,
});

export const REQUIRED_DOCUMENTS = ['registro-comercial', 'identidad-responsable'];

/** Crea una solicitud con todo lo exigido, sin enviarla. */
export async function readyStore(owner: Browser, patch: object = {}): Promise<string> {
  const res = await owner.post('/api/stores', application(patch));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const { id } = res.body;
  for (const key of REQUIRED_DOCUMENTS) {
    const upload = await owner.upload(`/api/stores/${id}/documents/${key}`, await png(), 'image/png');
    expect(upload.status, JSON.stringify(upload.body)).toBe(201);
  }
  return id;
}

export async function decide(reviewer: Browser, id: string, action: string, reason = '') {
  return reviewer.post(`/api/admin/store-reviews/${id}/decision`, { action, reason });
}

/** Tienda aprobada y su propietario, con 2FA. */
export async function approvedStore(t: TestIdentity, reviewer: Browser, patch: object = {}): Promise<{ owner: Browser; id: string }> {
  const owner = await t.signedIn('customer', true);
  const id = await readyStore(owner, patch);
  await owner.post(`/api/stores/${id}/submit`);
  await decide(reviewer, id, 'start_review');
  expect((await decide(reviewer, id, 'approve')).body.status).toBe('APPROVED');
  return { owner, id };
}
