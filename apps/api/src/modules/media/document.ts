import sharp from 'sharp';
import { imageMetadata } from './image.js';
import { unsupportedDocument, unsupportedImage, imageTooLarge } from './media.errors.js';

const MAX_PIXELS = 40_000_000;
const MAX_SIDE = 2400;
const TAIL = 1024;

export interface ProcessedDocument {
  data: Buffer;
  type: 'application/pdf' | 'image/webp';
}

/**
 * Un PDF no se puede recodificar: se comprueba que lo sea de principio a fin y se descarta el contenido activo a la vista.
 * Lo oculto en flujos comprimidos no se detecta; por eso siempre se entrega como descarga.
 */
function checkPdf(buffer: Buffer): ProcessedDocument {
  const head = buffer.toString('latin1', 0, 8);
  const tail = buffer.toString('latin1', Math.max(0, buffer.length - TAIL));
  if (!/^%PDF-[12]\.\d/.test(head) || !tail.includes('%%EOF')) throw unsupportedDocument();
  if (['/JavaScript', '/Launch', '/EmbeddedFile'].some((name) => buffer.includes(name, 0, 'latin1'))) throw unsupportedDocument();
  return { data: buffer, type: 'application/pdf' };
}

async function encodeImage(buffer: Buffer): Promise<ProcessedDocument> {
  const metadata = await imageMetadata(buffer);
  if (!metadata) throw unsupportedImage();
  if (metadata.width * metadata.height > MAX_PIXELS) throw imageTooLarge();
  try {
    const data = await sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: 'error' })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88 })
      .toBuffer();
    return { data, type: 'image/webp' };
  } catch {
    throw unsupportedImage();
  }
}

export async function processDocument(buffer: Buffer, type: string): Promise<ProcessedDocument> {
  return type === 'application/pdf' ? checkPdf(buffer) : encodeImage(buffer);
}
