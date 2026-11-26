import sharp from 'sharp';

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;

export const jpeg = (width = 400, height = 300) =>
  sharp({ create: { width, height, channels: 3, background: '#4060c0' } })
    .withExif({ IFD0: { Copyright: 'SECRETO-EXIF' } })
    .jpeg()
    .toBuffer();

export const png = (width = 40, height = 30) =>
  sharp({ create: { width, height, channels: 4, background: '#4060c0' } }).png().toBuffer();

const pad = (buffer: Buffer, fill: number) => Buffer.concat([buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4, fill)]);

function chunk(type: number, data: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32LE(data.length, 0);
  header.writeUInt32LE(type, 4);
  return Buffer.concat([header, data]);
}

/** Empaqueta un documento glTF cualquiera, válido o no. */
export function packGlb(document: unknown, bin: Buffer = Buffer.alloc(0)): Buffer {
  const body = [chunk(JSON_CHUNK, pad(Buffer.from(JSON.stringify(document)), 0x20))];
  if (bin.length > 0) body.push(chunk(BIN_CHUNK, pad(bin, 0)));
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'latin1');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + body.reduce((total, part) => total + part.length, 0), 8);
  return Buffer.concat([header, ...body]);
}

/** Triángulo mínimo válido; `patch` sustituye propiedades de la raíz. */
export function triangle(patch: Record<string, unknown> = {}): { document: Record<string, unknown>; bin: Buffer } {
  const bin = Buffer.alloc(36);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) => bin.writeFloatLE(value, index * 4));
  return {
    bin,
    document: {
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }],
      bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
      buffers: [{ byteLength: 36 }],
      ...patch,
    },
  };
}

export function glb(patch: Record<string, unknown> = {}): Buffer {
  const { document, bin } = triangle(patch);
  return packGlb(document, bin);
}

/** Triángulo con una imagen incrustada como textura. */
export function texturedGlb(image: Buffer, mimeType = 'image/png'): Buffer {
  const { document, bin } = triangle();
  const all = Buffer.concat([bin, image]);
  return packGlb(
    {
      ...document,
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: image.length },
      ],
      buffers: [{ byteLength: all.length }],
      images: [{ bufferView: 1, mimeType }],
      textures: [{ source: 0 }],
    },
    all,
  );
}
