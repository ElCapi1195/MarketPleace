import { z } from 'zod';
import { imageMetadata } from './image.js';
import { invalidModel } from './media.errors.js';

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const MAX_JSON = 4 * 1024 * 1024;
const MAX_NODES = 5000;
const MAX_PRIMITIVES = 500;
const MAX_DRAWS = 2000;
const MAX_TRIANGLES = 500_000;
const MAX_TEXTURES = 16;
const MAX_TEXTURE_SIDE = 4096;

// Solo materiales y datos que el visor entiende sin descodificadores ni descargas.
const EXTENSIONS = new Set([
  'KHR_lights_punctual',
  'KHR_materials_anisotropy',
  'KHR_materials_clearcoat',
  'KHR_materials_emissive_strength',
  'KHR_materials_ior',
  'KHR_materials_iridescence',
  'KHR_materials_sheen',
  'KHR_materials_specular',
  'KHR_materials_transmission',
  'KHR_materials_unlit',
  'KHR_materials_volume',
  'KHR_mesh_quantization',
  'KHR_texture_transform',
]);
const COMPONENT_BYTES = new Map([[5120, 1], [5121, 1], [5122, 2], [5123, 2], [5125, 4], [5126, 4]]);
const COMPONENTS = new Map([['SCALAR', 1], ['VEC2', 2], ['VEC3', 3], ['VEC4', 4], ['MAT2', 4], ['MAT3', 9], ['MAT4', 16]]);

const index = z.number().int().min(0);
const viewSchema = z.object({
  buffer: z.literal(0),
  byteOffset: index.default(0),
  byteLength: index,
  byteStride: z.number().int().min(4).max(252).optional(),
});
const accessorSchema = z.object({
  bufferView: index,
  byteOffset: index.default(0),
  componentType: z.number(),
  count: z.number().int().min(1),
  type: z.string(),
  sparse: z.undefined().optional(),
});
const meshSchema = z.object({
  primitives: z.array(z.object({ attributes: z.record(z.string(), index), indices: index.optional() })).min(1),
});
const documentSchema = z.object({
  asset: z.object({ version: z.literal('2.0') }),
  extensionsUsed: z.array(z.string()).default([]),
  buffers: z.array(z.object({ byteLength: index })).max(1).default([]),
  bufferViews: z.array(viewSchema).default([]),
  accessors: z.array(accessorSchema).default([]),
  images: z
    .array(z.object({ bufferView: index, mimeType: z.enum(['image/png', 'image/jpeg']) }))
    .max(MAX_TEXTURES)
    .default([]),
  meshes: z.array(meshSchema).min(1),
  nodes: z
    .array(z.object({ mesh: index.optional(), children: z.array(index).default([]) }))
    .min(1)
    .max(MAX_NODES),
});
type Document = z.output<typeof documentSchema>;

export interface GlbInfo {
  triangles: number;
  textures: number;
}

function unpack(buffer: Buffer): { json: unknown; bin: Buffer } {
  if (buffer.length < 20 || buffer.toString('latin1', 0, 4) !== 'glTF') throw invalidModel('no es un archivo .glb');
  if (buffer.readUInt32LE(4) !== 2) throw invalidModel('debe ser glTF 2.0');
  if (buffer.readUInt32LE(8) !== buffer.length) throw invalidModel('está incompleto');

  const chunks: { type: number; data: Buffer }[] = [];
  for (let offset = 12; offset < buffer.length; ) {
    if (offset + 8 > buffer.length) throw invalidModel('está incompleto');
    const end = offset + 8 + buffer.readUInt32LE(offset);
    if (end > buffer.length) throw invalidModel('está incompleto');
    chunks.push({ type: buffer.readUInt32LE(offset + 4), data: buffer.subarray(offset + 8, end) });
    offset = end;
  }
  const [head, body] = chunks;
  if (chunks.length > 2 || head?.type !== JSON_CHUNK || (body && body.type !== BIN_CHUNK)) {
    throw invalidModel('su estructura no es válida');
  }
  if (head.data.length > MAX_JSON) throw invalidModel('su descripción es demasiado grande');
  try {
    return { json: JSON.parse(head.data.toString('utf8')), bin: body?.data ?? Buffer.alloc(0) };
  } catch {
    throw invalidModel('su descripción no es válida');
  }
}

/** Busca `uri` a cualquier profundidad: un modelo no debe hacer que el visitante descargue nada más. */
function assertSelfContained(json: unknown): void {
  const pending: unknown[] = [json];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== 'object' || value === null) continue;
    if (Object.hasOwn(value, 'uri')) throw invalidModel('contiene recursos externos; expórtalo con todo incrustado');
    for (const child of Object.values(value)) pending.push(child);
  }
}

function assertData({ buffers, bufferViews, accessors }: Document, bin: Buffer): void {
  const damaged = () => invalidModel('sus datos están dañados');
  const declared = buffers[0]?.byteLength ?? 0;
  if (declared > bin.length) throw invalidModel('le faltan datos');
  for (const { byteOffset, byteLength } of bufferViews) {
    if (byteOffset + byteLength > declared) throw damaged();
  }
  for (const { bufferView, byteOffset, componentType, count, type } of accessors) {
    const view = bufferViews[bufferView];
    const size = (COMPONENT_BYTES.get(componentType) ?? 0) * (COMPONENTS.get(type) ?? 0);
    if (!view || size === 0) throw damaged();
    if (byteOffset + (view.byteStride ?? size) * (count - 1) + size > view.byteLength) throw damaged();
  }
}

/** La escena debe ser un bosque: un ciclo colgaría el visor de quien la abra. */
function assertHierarchy({ nodes, meshes }: Document): void {
  const damaged = () => invalidModel('su escena está dañada');
  const owned = new Set<number>();
  for (const { mesh, children } of nodes) {
    if (mesh !== undefined && !meshes[mesh]) throw damaged();
    for (const child of children) {
      if (!nodes[child] || owned.has(child)) throw damaged();
      owned.add(child);
    }
  }
  // Con un solo padre por nodo, un ciclo es justo lo que no se alcanza desde ninguna raíz.
  const reached = nodes.flatMap((_node, id) => (owned.has(id) ? [] : [id]));
  for (const id of reached) reached.push(...(nodes[id]?.children ?? []));
  if (reached.length !== nodes.length) throw damaged();
}

function countTriangles({ nodes, meshes, accessors }: Document): number {
  const damaged = () => invalidModel('sus datos están dañados');
  if (meshes.reduce((total, { primitives }) => total + primitives.length, 0) > MAX_PRIMITIVES) {
    throw invalidModel('tiene demasiadas piezas');
  }
  const perMesh = meshes.map(({ primitives }) =>
    primitives.reduce((total, { attributes, indices }) => {
      if (Object.values(attributes).some((id) => !accessors[id])) throw damaged();
      const source = accessors[indices ?? attributes.POSITION ?? -1];
      if (!source) throw damaged();
      return total + Math.ceil(source.count / 3);
    }, 0),
  );
  let draws = 0;
  let triangles = 0;
  for (const { mesh } of nodes) {
    if (mesh === undefined) continue;
    draws += meshes[mesh]?.primitives.length ?? 0;
    triangles += perMesh[mesh] ?? 0;
  }
  if (draws > MAX_DRAWS || triangles > MAX_TRIANGLES) {
    throw invalidModel('tiene demasiado detalle; redúcelo a 500 000 triángulos');
  }
  return triangles;
}

async function assertTextures({ images, bufferViews }: Document, bin: Buffer): Promise<void> {
  for (const { bufferView, mimeType } of images) {
    const view = bufferViews[bufferView];
    if (!view) throw invalidModel('una textura está dañada');
    const metadata = await imageMetadata(bin.subarray(view.byteOffset, view.byteOffset + view.byteLength));
    if (!metadata || `image/${metadata.format}` !== mimeType) throw invalidModel('una textura no es PNG o JPEG');
    if (Math.max(metadata.width, metadata.height) > MAX_TEXTURE_SIDE) {
      throw invalidModel('una textura supera los 4096 píxeles');
    }
  }
}

/** Valida un modelo 3D sin ejecutarlo ni modificarlo. Lanza con el motivo si no se puede publicar. */
export async function inspectGlb(buffer: Buffer): Promise<GlbInfo> {
  const { json, bin } = unpack(buffer);
  assertSelfContained(json);
  const result = documentSchema.safeParse(json);
  if (!result.success) throw invalidModel('su estructura no es válida');
  const document = result.data;

  if (document.extensionsUsed.some((name) => !EXTENSIONS.has(name))) {
    throw invalidModel('usa una extensión no admitida; expórtalo sin compresión');
  }
  assertData(document, bin);
  assertHierarchy(document);
  const triangles = countTriangles(document);
  await assertTextures(document, bin);
  return { triangles, textures: document.images.length };
}
