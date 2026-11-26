import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { text } from 'node:stream/consumers';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inspectGlb } from '../src/modules/media/glb.js';
import { processImage } from '../src/modules/media/image.js';
import { readBody } from '../src/modules/media/read-body.js';
import { diskStorage, type StoragePort } from '../src/modules/media/storage.js';
import { glb, jpeg, packGlb, png, texturedGlb, triangle } from './support/files.js';

const rejected = (code: string) => expect.objectContaining({ response: expect.objectContaining({ code }) });

describe('processImage', () => {
  it('recodifica a WebP en dos tamaños y sin metadatos', async () => {
    const result = await processImage(await jpeg(3200, 2400));
    const [lg, sm] = await Promise.all([sharp(result.lg).metadata(), sharp(result.sm).metadata()]);
    expect([lg.format, lg.width, lg.height]).toEqual(['webp', 1600, 1200]);
    expect([sm.format, sm.width, sm.height]).toEqual(['webp', 640, 480]);
    expect([result.width, result.height]).toEqual([1600, 1200]);
    expect(lg.exif).toBeUndefined();
    expect(result.lg.includes('SECRETO-EXIF')).toBe(false);
  });

  it('no amplía una foto pequeña', async () => {
    const { lg } = await processImage(await png(40, 30));
    expect((await sharp(lg).metadata()).width).toBe(40);
  });

  it('endereza la foto según su orientación EXIF', async () => {
    const turned = await sharp(await jpeg(400, 300)).withMetadata({ orientation: 6 }).toBuffer();
    const { width, height } = await processImage(turned);
    expect([width, height]).toEqual([300, 400]);
  });

  it.each([
    ['SVG', '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9"><script>alert(1)</script></svg>'],
    ['HTML', '<!doctype html><script>alert(1)</script>'],
    ['GIF', 'GIF89a\u0001\u0000\u0001\u0000'],
    ['vacío', ''],
  ])('rechaza %s aunque diga ser una foto', async (_name, content) => {
    await expect(processImage(Buffer.from(content, 'latin1'))).rejects.toEqual(rejected('UNSUPPORTED_IMAGE'));
  });

  it('rechaza un JPEG que solo tiene la cabecera', async () => {
    const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
    await expect(processImage(broken)).rejects.toEqual(rejected('UNSUPPORTED_IMAGE'));
  });

  it('rechaza una bomba de píxeles', async () => {
    const bomb = await sharp({ create: { width: 8000, height: 8000, channels: 3, background: '#000' } }).png().toBuffer();
    await expect(processImage(bomb)).rejects.toEqual(rejected('IMAGE_TOO_LARGE'));
  }, 20_000);
});

describe('inspectGlb', () => {
  const invalid = (buffer: Buffer) => expect(inspectGlb(buffer)).rejects.toEqual(rejected('INVALID_MODEL'));

  it('acepta un modelo mínimo', async () => {
    await expect(inspectGlb(glb())).resolves.toEqual({ triangles: 1, textures: 0 });
  });

  it('acepta una textura incrustada', async () => {
    await expect(inspectGlb(texturedGlb(await png()))).resolves.toEqual({ triangles: 1, textures: 1 });
  });

  it.each([
    ['vacío', Buffer.alloc(0)],
    ['texto', Buffer.from('esto no es un modelo, pero ocupa espacio')],
    ['truncado', glb().subarray(0, 60)],
    ['con bytes de más', Buffer.concat([glb(), Buffer.alloc(4)])],
    ['con JSON que no es un objeto', packGlb([])],
    ['versión 1', glb({ asset: { version: '1.0' } })],
    ['sin mallas', glb({ meshes: [] })],
    ['búfer externo', glb({ buffers: [{ byteLength: 36, uri: 'https://malo.test/x.bin' }] })],
    ['imagen externa', glb({ images: [{ uri: 'https://malo.test/x.png' }] })],
    ['imagen data:', glb({ images: [{ uri: 'data:image/png;base64,AAAA' }] })],
    ['uri escondido en extras', glb({ nodes: [{ mesh: 0, extensions: { KHR_lights_punctual: { uri: 'x' } } }] })],
    ['extensión desconocida', glb({ extensionsUsed: ['KHR_draco_mesh_compression'] })],
    ['dos búferes', glb({ buffers: [{ byteLength: 36 }, { byteLength: 36 }] })],
    ['vista fuera del búfer', glb({ bufferViews: [{ buffer: 0, byteOffset: 8, byteLength: 36 }] })],
    ['accesor mayor que su vista', glb({ accessors: [{ bufferView: 0, componentType: 5126, count: 4, type: 'VEC3' }] })],
    ['accesor sin vista', glb({ accessors: [{ componentType: 5126, count: 3, type: 'VEC3' }] })],
    ['cuenta negativa', glb({ accessors: [{ bufferView: 0, componentType: 5126, count: -3, type: 'VEC3' }] })],
    ['nodo que es su propio padre', glb({ nodes: [{ mesh: 0, children: [0] }] })],
    ['ciclo de nodos', glb({ nodes: [{ mesh: 0, children: [1] }, { children: [0] }] })],
    ['nodo con dos padres', glb({ nodes: [{ children: [2] }, { children: [2] }, { mesh: 0 }], scenes: [{ nodes: [0, 1] }] })],
    ['nodo hijo inexistente', glb({ nodes: [{ mesh: 0, children: [9] }] })],
    ['malla inexistente', glb({ nodes: [{ mesh: 4 }] })],
    ['demasiados nodos', glb({ nodes: Array.from({ length: 5001 }, () => ({ mesh: 0 })) })],
  ])('rechaza un archivo %s', async (_name, buffer) => {
    await invalid(buffer);
  });

  it('rechaza una malla con demasiados triángulos', async () => {
    const primitives = Array.from({ length: 1001 }, () => ({ attributes: { POSITION: 0 } }));
    await invalid(glb({ meshes: [{ primitives }] }));
  });

  it('cuenta los triángulos de cada copia de una malla, no solo los del archivo', async () => {
    const count = 3000;
    const bin = Buffer.alloc(count * 12);
    const { document } = triangle({
      nodes: Array.from({ length: 1200 }, () => ({ mesh: 0 })),
      scenes: [{ nodes: Array.from({ length: 1200 }, (_, index) => index) }],
      accessors: [{ bufferView: 0, componentType: 5126, count, type: 'VEC3' }],
      bufferViews: [{ buffer: 0, byteLength: bin.length }],
      buffers: [{ byteLength: bin.length }],
    });
    await invalid(packGlb(document, bin));
  });

  it('rechaza una textura que no es una imagen', async () => {
    await invalid(texturedGlb(Buffer.from('<svg onload="alert(1)">')));
  });

  it('rechaza una textura desmesurada', async () => {
    await invalid(texturedGlb(await png(4097, 2)));
  });

  it('rechaza un tipo de textura no admitido', async () => {
    await invalid(texturedGlb(await png(), 'image/svg+xml'));
  });
});

describe('diskStorage', () => {
  let directory: string;
  let storage: StoragePort;
  const id = '019338c2-7a50-4c0e-9d54-2f1a3b4c5d6e';

  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'marketplace-media-'));
    storage = diskStorage(directory);
  });
  afterAll(() => rm(directory, { recursive: true, force: true }));

  it('guarda, sirve y elimina', async () => {
    await storage.put(id, 'sm', Buffer.from('hola'));
    const file = await storage.open(id, 'sm');
    expect(file?.size).toBe(4);
    expect(await text(file?.stream ?? Readable.from([]))).toBe('hola');
    await storage.remove(id);
    expect(await storage.open(id, 'sm')).toBeNull();
    expect(await readdir(directory)).toEqual([]);
  });

  it.each(['../../etc', '..', '', 'a/b', 'C:\\x', `${id}/..`])('rechaza la clave %j', async (key) => {
    await expect(storage.put(key, 'sm', Buffer.from('x'))).rejects.toThrow();
    expect(await storage.open(key, 'sm')).toBeNull();
    await expect(storage.remove(key)).rejects.toThrow();
    expect(existsSync(directory)).toBe(true);
  });
});

describe('readBody', () => {
  const body = (chunks: Buffer[], headers: Record<string, string> = {}) =>
    Object.assign(Readable.from(chunks), { headers }) as unknown as Parameters<typeof readBody>[0];

  it('devuelve el cuerpo completo', async () => {
    expect((await readBody(body([Buffer.from('ab'), Buffer.from('c')]), 3)).toString()).toBe('abc');
  });

  it('corta al superar el límite aunque no se declare el tamaño', async () => {
    await expect(readBody(body([Buffer.alloc(3), Buffer.alloc(3)]), 5)).rejects.toEqual(rejected('FILE_TOO_LARGE'));
  });

  it('rechaza por el tamaño declarado', async () => {
    await expect(readBody(body([], { 'content-length': '6' }), 5)).rejects.toEqual(rejected('FILE_TOO_LARGE'));
  });
});
