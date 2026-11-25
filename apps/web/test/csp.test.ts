import { describe, expect, it } from 'vitest';
import { buildCsp } from '../lib/security/csp';

describe('buildCsp', () => {
  const production = buildCsp('abc123', false);

  it('autoriza scripts y estilos solo con el nonce', () => {
    expect(production).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(production).toContain("style-src 'self' 'nonce-abc123'");
  });

  it('no permite inline ni eval en producción', () => {
    expect(production).not.toMatch(/unsafe-inline|unsafe-eval/);
  });

  it('bloquea el enmarcado, los plugins y las bases ajenas', () => {
    for (const directive of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'self'"]) {
      expect(production).toContain(directive);
    }
  });

  it('relaja solo lo que exige la recarga en desarrollo', () => {
    expect(buildCsp('abc123', true)).toContain("'unsafe-eval'");
  });
});
