import { StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import type { DocumentFile } from './document.service.js';

/** Siempre como descarga: un documento nunca se muestra dentro del sitio. */
export function sendDocument(res: Response, { stream, size, type, filename }: DocumentFile): StreamableFile {
  res.setHeader('cache-control', 'private, no-store');
  return new StreamableFile(stream, { type, length: size, disposition: `attachment; filename="${filename}"` });
}
