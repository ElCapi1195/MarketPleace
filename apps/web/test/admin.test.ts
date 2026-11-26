import { describe, expect, it } from 'vitest';
import { checkFile } from '../features/admin/lib/files';
import { adminMessage } from '../features/admin/lib/messages';
import { emptyValues, toInput, toValues, type FormContext } from '../features/admin/lib/product-form';

const context: FormContext = {
  currency: 'USD',
  categories: [
    {
      slug: 'cosas',
      name: 'Cosas',
      attributes: [
        { key: 'state', label: 'Estado', type: 'select', required: true, options: [{ value: 'nuevo', label: 'Nuevo' }] },
        { key: 'weight', label: 'Peso', type: 'number', required: false },
        { key: 'boxed', label: 'Con caja', type: 'boolean', required: false },
      ],
    },
    { slug: 'otras', name: 'Otras', attributes: [] },
  ],
};
const storeId = '019338c2-7a50-7c0e-9d54-2f1a3b4c5d6e';
const values = {
  ...emptyValues(context),
  storeId,
  title: ' Producto ',
  price: '1.299,90',
  deposit: '',
  units: '4',
  'attributes.state': 'nuevo',
  'attributes.weight': '2,5',
  'attributes.boxed': 'on',
};

describe('toInput', () => {
  it('convierte los campos en la entrada de la API', () => {
    expect(toInput(values, context)).toEqual({
      ok: true,
      input: {
        storeId,
        title: 'Producto',
        description: '',
        categorySlug: 'cosas',
        kind: 'IN_STOCK',
        priceMinor: 129990,
        depositMinor: 0,
        units: 4,
        availableOn: null,
        attributes: { state: 'nuevo', weight: 2.5, boxed: true },
        featured: false,
      },
    });
  });

  it('al cambiar de categoría no arrastra características de la anterior', () => {
    const result = toInput({ ...values, categorySlug: 'otras' }, context);
    expect(result.ok && result.input.attributes).toEqual({});
  });

  it('ignora la fecha si deja de ser preventa y las unidades si es un servicio', () => {
    expect(toInput({ ...values, availableOn: '2027-01-10' }, context)).toMatchObject({ input: { availableOn: null } });
    expect(toInput({ ...values, kind: 'SERVICE' }, context)).toMatchObject({ input: { units: null } });
  });

  it.each([
    ['tienda', { storeId: '' }, 'Elige la tienda.'],
    ['título', { title: 'ab' }, 'El título necesita al menos 3 caracteres.'],
    ['precio', { price: 'caro' }, 'Revisa el precio. Ejemplo: 549,90'],
    ['depósito', { deposit: '-1' }, 'Revisa el depósito. Ejemplo: 100'],
    ['depósito mayor', { deposit: '2000' }, 'El depósito no puede superar el precio.'],
    ['unidades', { units: '1,5' }, 'Las unidades deben ser un número entero.'],
    ['fecha', { kind: 'PREORDER', availableOn: '' }, 'Una preventa necesita la fecha estimada de llegada.'],
    ['característica', { 'attributes.state': '' }, 'Completa «Estado».'],
    ['número', { 'attributes.weight': 'x' }, 'Revisa «Peso»: debe ser un número.'],
  ])('explica qué falla en %s', (_name, patch, error) => {
    expect(toInput({ ...values, ...patch }, context)).toEqual({ ok: false, error });
  });
});

describe('toValues', () => {
  it('recupera los campos de un producto guardado y vuelve a producir lo mismo', () => {
    const result = toInput(values, context);
    if (!result.ok) throw new Error(result.error);
    const { storeId: id, ...rest } = result.input;
    const again = toValues({ ...rest, store: { id, name: 'Tienda' } }, context);
    expect(again.price).toBe('1299,9');
    expect(toInput(again, context)).toEqual(result);
  });
});

describe('checkFile', () => {
  const file = (name: string, type: string, size = 10) => ({ name, type, size });

  it('reconoce fotos y modelos, aunque el navegador no sepa el tipo del modelo', () => {
    expect(checkFile(file('a.JPG', 'image/jpeg'))).toEqual({ ok: true, type: 'image/jpeg' });
    expect(checkFile(file('a.glb', ''))).toEqual({ ok: true, type: 'model/gltf-binary' });
    expect(checkFile(file('a.GLB', 'application/octet-stream'))).toEqual({ ok: true, type: 'model/gltf-binary' });
  });

  it.each([
    [file('a.svg', 'image/svg+xml'), 'formato'],
    [file('a.gltf', 'model/gltf+json'), 'formato'],
    [file('a.png', 'image/png', 0), 'vacío'],
    [file('a.png', 'image/png', 11 * 1024 * 1024), '10 MB'],
    [file('a.glb', '', 16 * 1024 * 1024), '15 MB'],
  ])('rechaza %j', (input, reason) => {
    const result = checkFile(input);
    expect(!result.ok && result.error).toContain(reason);
  });
});

describe('adminMessage', () => {
  it('usa el texto del servidor cuando está escrito para personas', () => {
    expect(adminMessage({ ok: false, status: 422, code: 'INVALID_MODEL', message: 'El modelo 3D no se puede usar: está incompleto.' })).toContain('incompleto');
  });

  it('no muestra textos internos', () => {
    expect(adminMessage({ ok: false, status: 500, code: 'INTERNAL_ERROR', message: 'stack' })).not.toContain('stack');
  });
});
