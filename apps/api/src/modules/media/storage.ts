import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

export const variants = ['lg', 'sm', 'model', 'doc'] as const;
export type Variant = (typeof variants)[number];

export interface StoredFile {
  size: number;
  stream: Readable;
}

/** Almacén de archivos. Hoy es un volumen; S3 tendría la misma forma. */
export interface StoragePort {
  put(id: string, variant: Variant, data: Buffer): Promise<void>;
  open(id: string, variant: Variant): Promise<StoredFile | null>;
  /** Elimina todas las variantes. */
  remove(id: string): Promise<void>;
}

export const STORAGE = Symbol('STORAGE');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Guarda en disco, fuera de lo que sirve la web. Solo acepta UUID: ninguna clave sale del directorio. */
export function diskStorage(directory: string): StoragePort {
  const folder = (id: string) => {
    if (!UUID.test(id)) throw new Error('clave de archivo no válida');
    return path.join(directory, id);
  };
  return {
    put: async (id, variant, data) => {
      const target = folder(id);
      await mkdir(target, { recursive: true });
      await writeFile(path.join(target, variant), data, { flag: 'wx' });
    },
    open: async (id, variant) => {
      if (!UUID.test(id)) return null;
      const file = path.join(folder(id), variant);
      const info = await stat(file).catch(() => null);
      return info?.isFile() ? { size: info.size, stream: createReadStream(file) } : null;
    },
    remove: async (id) => rm(folder(id), { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }),
  };
}
