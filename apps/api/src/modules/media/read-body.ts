import type { IncomingMessage } from 'node:http';
import { fileTooLarge } from './media.errors.js';

const DRAIN_FACTOR = 4;

/** Lee el cuerpo hasta un máximo. Se llama después de autorizar: nadie sin permiso ocupa memoria. */
export async function readBody(request: IncomingMessage, limit: number): Promise<Buffer> {
  let tooLarge = Number(request.headers['content-length'] ?? 0) > limit;
  let chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = chunk as Buffer;
    size += bytes.length;
    if (size > limit) tooLarge = true;
    // Se descarta el resto sin guardarlo: cortar la conexión ocultaría el motivo al navegador.
    if (size > limit * DRAIN_FACTOR) break;
    if (tooLarge) chunks = [];
    else chunks.push(bytes);
  }
  if (tooLarge) throw fileTooLarge();
  return Buffer.concat(chunks, size);
}
