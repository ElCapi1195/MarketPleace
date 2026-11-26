import sharp, { type Metadata } from 'sharp';
import { imageTooLarge, unsupportedImage } from './media.errors.js';

const MAX_PIXELS = 40_000_000;
const LARGE = 1600;
const SMALL = 640;

export interface ProcessedImage {
  lg: Buffer;
  sm: Buffer;
  width: number;
  height: number;
}

const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Comprueba la firma antes de entregar los bytes al decodificador, que admite muchos más formatos. */
function imageFormat(buffer: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buffer.length < 16) return null;
  if (buffer.subarray(0, JPEG.length).equals(JPEG)) return 'jpeg';
  if (buffer.subarray(0, PNG.length).equals(PNG)) return 'png';
  if (buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/** Datos de una imagen admitida; null si el contenido no lo es. No decodifica los píxeles. */
export async function imageMetadata(buffer: Buffer): Promise<Metadata | null> {
  const format = imageFormat(buffer);
  if (format === null) return null;
  // El límite de píxeles se comprueba aparte, para poder explicarlo.
  const metadata = await sharp(buffer, { limitInputPixels: false })
    .metadata()
    .catch(() => null);
  return metadata?.format === format ? metadata : null;
}

/** Decodifica y vuelve a codificar: lo que se guarda nunca son los bytes recibidos, ni sus metadatos. */
export async function processImage(buffer: Buffer): Promise<ProcessedImage> {
  const metadata = await imageMetadata(buffer);
  if (!metadata) throw unsupportedImage();
  if (metadata.width * metadata.height > MAX_PIXELS) throw imageTooLarge();

  const render = (size: number, quality: number) =>
    sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: 'error' })
      .rotate()
      .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
      .webp({ quality })
      .toBuffer({ resolveWithObject: true });
  try {
    const [lg, sm] = await Promise.all([render(LARGE, 84), render(SMALL, 80)]);
    return { lg: lg.data, sm: sm.data, width: lg.info.width, height: lg.info.height };
  } catch {
    throw unsupportedImage();
  }
}
