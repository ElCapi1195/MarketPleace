import { describe, expect, it } from 'vitest';
import { invitationAccept, invitationInput, moderationInput, storeApplicationInput } from '../src/index.js';

describe('entradas de tienda', () => {
  const valid = { name: 'Mi tienda', about: '', legalName: '', taxId: '', phone: '', address: '' };

  it('una solicitud puede guardarse incompleta, pero no con campos ajenos', () => {
    expect(storeApplicationInput.safeParse(valid).success).toBe(true);
    expect(storeApplicationInput.safeParse({ ...valid, status: 'APPROVED' }).success).toBe(false);
    expect(storeApplicationInput.safeParse({ ...valid, name: ' ' }).success).toBe(false);
  });

  it('normaliza el correo de la invitación y no permite invitar propietarios', () => {
    expect(invitationInput.parse({ email: ' Ana@Example.TEST ', role: 'STAFF' }).email).toBe('ana@example.test');
    expect(invitationInput.safeParse({ email: 'a@b.test', role: 'OWNER' }).success).toBe(false);
  });

  it.each(['', 'corto', 'a'.repeat(44), `${'a'.repeat(42)}/`])('rechaza el token %j', (token) => {
    expect(invitationAccept.safeParse({ token }).success).toBe(false);
  });

  it('rechazar un producto exige motivo', () => {
    expect(moderationInput.safeParse({ action: 'reject', version: 1 }).success).toBe(false);
    expect(moderationInput.safeParse({ action: 'approve', version: 1 }).success).toBe(true);
  });
});
