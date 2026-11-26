import { imageTypes, MAX_IMAGE_BYTES, MAX_MODEL_BYTES, modelType } from '@marketplace/contracts';

type Check = { ok: true; type: string } | { ok: false; error: string };

const megabytes = (bytes: number) => `${bytes / 1024 / 1024} MB`;

/** Revisión previa para avisar sin esperar; el servidor vuelve a comprobar el contenido. */
export function checkFile({ name, type, size }: Pick<File, 'name' | 'type' | 'size'>): Check {
  const isModel = name.toLowerCase().endsWith('.glb');
  if (!isModel && !(imageTypes as readonly string[]).includes(type)) {
    return { ok: false, error: `${name}: formato no admitido. Usa JPEG, PNG, WebP o .glb.` };
  }
  if (size === 0) return { ok: false, error: `${name} está vacío.` };
  const limit = isModel ? MAX_MODEL_BYTES : MAX_IMAGE_BYTES;
  if (size > limit) return { ok: false, error: `${name} supera ${megabytes(limit)}.` };
  return { ok: true, type: isModel ? modelType : type };
}
