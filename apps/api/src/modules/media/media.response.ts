import { modelType } from '@marketplace/contracts';
import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import type { StoredFile } from './storage.js';

export const PUBLIC = 'public, max-age=86400';
export const PRIVATE = 'private, no-store';

/** El tipo lo decide el servidor, nunca quien subió el archivo. */
export function sendMedia(res: Response, variant: string, { stream, size }: StoredFile, cache: string): StreamableFile {
  res.setHeader('cache-control', cache);
  return new StreamableFile(stream, { type: variant === 'model' ? modelType : 'image/webp', length: size });
}
