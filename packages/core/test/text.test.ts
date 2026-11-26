import { describe, expect, it } from 'vitest';
import { fold, slugify } from '../src/index.js';

describe('fold', () => {
  it('ignora tildes, mayúsculas y signos', () => {
    expect(fold('  Edición: COLECCIÓN_100% ')).toBe('edicion coleccion 100');
  });

  it('no deja comodines de búsqueda', () => {
    expect(fold('%_\\')).toBe('');
  });
});

describe('slugify', () => {
  it('produce un slug', () => {
    expect(slugify('Cámara 4K — ñandú')).toBe('camara-4k-nandu');
  });

  it('no supera el largo ni termina en guion', () => {
    expect(slugify(`${'a'.repeat(59)} bcd`)).toBe('a'.repeat(59));
  });

  it('con un texto sin letras latinas devuelve un valor usable', () => {
    expect(slugify('日本')).toBe('articulo');
  });
});
