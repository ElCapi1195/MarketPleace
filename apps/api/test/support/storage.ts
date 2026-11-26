import { Readable } from 'node:stream';
import type { StoragePort } from '../../src/modules/media/storage.js';

export interface MemoryStorage extends StoragePort {
  readonly files: Map<string, Buffer>;
}

/** Almacén en memoria para comprobar qué queda guardado. */
export function memoryStorage(): MemoryStorage {
  const files = new Map<string, Buffer>();
  return {
    files,
    put: async (id, variant, data) => {
      files.set(`${id}/${variant}`, data);
    },
    open: async (id, variant) => {
      const data = files.get(`${id}/${variant}`);
      return data ? { size: data.length, stream: Readable.from([data]) } : null;
    },
    remove: async (id) => {
      for (const key of files.keys()) if (key.startsWith(`${id}/`)) files.delete(key);
    },
  };
}
